import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@tanstack/react-router", async () => (await import("./auth-harness")).routerMock);
vi.mock("@/integrations/supabase/client", async () => ({ supabase: (await import("./auth-harness")).supabase }));
vi.mock("@/integrations/lovable", async () => ({ lovable: (await import("./auth-harness")).lovable }));
vi.mock("@/lib/booking-requests", async () => ({ useSessionUser: (await import("./auth-harness")).useSessionUser }));
vi.mock("sonner", async () => ({ toast: (await import("./auth-harness")).toast }));

import { auth, navigate, pageOf, resetAuthHarness, roles, routerState, session, toast, upsert } from "./auth-harness";
import { Route as AuthRoute } from "@/routes/auth";
import { RoleResumeGuard } from "@/components/RoleResumeGuard";
import { AUTH_REDIRECT_KEY, SIGNUP_ROLE_KEY } from "@/lib/auth-redirect";

const AuthPage = pageOf(AuthRoute);
const errors = vi.spyOn(console, "error");
const warnings = vi.spyOn(console, "warn");
let queryClient: QueryClient;

function renderWithQuery(ui: ReactNode) {
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}
const fill = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: password } });
};
async function openSignup(role: "Voyageur" | "Hôte") {
  renderWithQuery(<AuthPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Pas encore de compte ? Inscrivez-vous" }));
  fireEvent.click(screen.getByRole("button", { name: role }));
  expect(screen.getByRole("button", { name: role })).toHaveAttribute("aria-pressed", "true");
}

beforeEach(() => {
  resetAuthHarness();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  errors.mockClear();
  warnings.mockClear();
});
afterEach(() => {
  cleanup();
  // "sans avertissement": no React act()/key warnings or console errors during auth flows.
  expect(errors).not.toHaveBeenCalled();
  expect(warnings).not.toHaveBeenCalled();
});

describe("Inscription par e-mail — Voyageur", () => {
  it("enregistre le rôle voyageur et renvoie vers la page d’origine", async () => {
    routerState.search = { redirect: "/hebergement/abc" };
    auth.signUp.mockImplementation(async () => {
      const user = { id: "traveler-1", email: "anouk@example.fr" };
      queueMicrotask(() => session.set(user)); // onAuthStateChange after an auto-confirmed signup
      return { data: { user, session: {} }, error: null };
    });
    await openSignup("Voyageur");
    fill("anouk@example.fr", "motdepasse1");
    fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ href: "/hebergement/abc", replace: true }));
    expect(auth.signUp).toHaveBeenCalledWith({ email: "anouk@example.fr", password: "motdepasse1", options: { emailRedirectTo: "http://localhost:3000/auth" } });
    expect(upsert).toHaveBeenCalledWith({ user_id: "traveler-1", role: "voyageur" }, { onConflict: "user_id", ignoreDuplicates: true });
    expect(roles.get("traveler-1")).toBe("voyageur");
    expect(queryClient.getQueryData(["account-role", "traveler-1"])).toBe("voyageur");
    expect(localStorage.getItem(`${SIGNUP_ROLE_KEY}:traveler-1`)).toBeNull();
    expect(localStorage.getItem(AUTH_REDIRECT_KEY)).toBeNull();
  });

  it("sans page d’origine, ouvre la recherche (/recherche) pour un premier séjour", async () => {
    auth.signUp.mockImplementation(async () => {
      const user = { id: "traveler-2", email: "t@example.fr" };
      queueMicrotask(() => session.set(user));
      return { data: { user, session: {} }, error: null };
    });
    await openSignup("Voyageur");
    fill("t@example.fr", "motdepasse1");
    fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ href: "/recherche", replace: true }));
  });

  it("refuse un e-mail invalide ou un mot de passe trop court sans appeler Supabase", async () => {
    await openSignup("Voyageur");
    // Accepted by the browser's type="email" check, refused by the app (no domain extension).
    fill("anouk@example", "motdepasse1");
    fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));
    expect(toast.error).toHaveBeenLastCalledWith("Email invalide");
    fill("ok@example.fr", "court");
    fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));
    expect(toast.error).toHaveBeenLastCalledWith("8 caractères minimum");
    expect(auth.signUp).not.toHaveBeenCalled();
  });
});

describe("Inscription par e-mail — Hôte (confirmation par lien)", () => {
  it("mémorise le rôle hôte, puis l’applique quand le lien de confirmation ouvre /auth", async () => {
    routerState.search = { redirect: "/mes-annonces/nouvelle" };
    auth.signUp.mockResolvedValue({ data: { user: { id: "host-1", email: "h@example.fr" }, session: null }, error: null });
    await openSignup("Hôte");
    fill("h@example.fr", "motdepasse1");
    fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Vérifiez votre boîte mail pour confirmer votre compte."));
    expect(localStorage.getItem(`${SIGNUP_ROLE_KEY}:host-1`)).toBe("hote");
    expect(localStorage.getItem(AUTH_REDIRECT_KEY)).toBe("/mes-annonces/nouvelle");
    expect(navigate).not.toHaveBeenCalled();
    cleanup();

    // New tab opened by the e-mail link: /auth without search params, session restored.
    routerState.search = {};
    session.set({ id: "host-1", email: "h@example.fr" });
    renderWithQuery(<AuthPage />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ href: "/mes-annonces/nouvelle", replace: true }));
    expect(roles.get("host-1")).toBe("hote");
    expect(localStorage.getItem(`${SIGNUP_ROLE_KEY}:host-1`)).toBeNull();
  });

  it("sans page d’origine, ouvre l’espace hôte (/mes-annonces)", async () => {
    localStorage.setItem(`${SIGNUP_ROLE_KEY}:host-2`, "hote");
    session.set({ id: "host-2", email: "h2@example.fr" });
    renderWithQuery(<AuthPage />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ href: "/mes-annonces", replace: true }));
  });

  it("n’applique pas un rôle mémorisé pour un autre compte", async () => {
    localStorage.setItem(`${SIGNUP_ROLE_KEY}:someone-else`, "hote");
    session.set({ id: "host-3", email: "h3@example.fr" });
    renderWithQuery(<AuthPage />);
    expect(await screen.findByRole("heading", { name: "Bienvenue sur PetInn" })).toBeInTheDocument();
    expect(upsert).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("Connexion d’un compte existant", () => {
  it.each([
    ["hote", "/mes-annonces"],
    ["voyageur", "/mes-demandes"],
  ])("conserve le rôle %s et ouvre son espace (%s)", async (role, dest) => {
    roles.set("user-1", role);
    auth.signInWithPassword.mockImplementation(async () => {
      queueMicrotask(() => session.set({ id: "user-1", email: "u@example.fr" }));
      return { data: {}, error: null };
    });
    renderWithQuery(<AuthPage />);
    fill("u@example.fr", "motdepasse1");
    fireEvent.click(await screen.findByRole("button", { name: "Se connecter" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ href: dest, replace: true }));
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "u@example.fr", password: "motdepasse1" });
    expect(upsert).not.toHaveBeenCalled();
    expect(roles.get("user-1")).toBe(role);
    expect(queryClient.getQueryData(["account-role", "user-1"])).toBe(role);
  });

  it("ne remplace jamais le rôle enregistré par un choix d’inscription resté en mémoire", async () => {
    roles.set("host-9", "hote");
    localStorage.setItem(`${SIGNUP_ROLE_KEY}:host-9`, "voyageur");
    session.set({ id: "host-9", email: "h9@example.fr" });
    renderWithQuery(<AuthPage />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ href: "/mes-annonces", replace: true }));
    expect(roles.get("host-9")).toBe("hote");
    expect(upsert).not.toHaveBeenCalled();
    expect(localStorage.getItem(`${SIGNUP_ROLE_KEY}:host-9`)).toBeNull();
  });

  it("affiche un message générique en cas d’identifiants incorrects", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: "Invalid login credentials" } });
    renderWithQuery(<AuthPage />);
    fill("u@example.fr", "mauvaismdp");
    fireEvent.click(await screen.findByRole("button", { name: "Se connecter" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Email ou mot de passe incorrect."));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("propose le lien « Mot de passe oublié ? »", async () => {
    renderWithQuery(<AuthPage />);
    expect(await screen.findByRole("link", { name: "Mot de passe oublié ?" })).toHaveAttribute("href", "/mot-de-passe-oublie");
  });
});

describe("Accès aux espaces dédiés (RoleResumeGuard)", () => {
  it("laisse un compte avec rôle accéder immédiatement à son espace", async () => {
    session.set({ id: "host-1", email: "h@example.fr" });
    queryClient.setQueryData(["account-role", "host-1"], "hote"); // set by /auth at sign-in
    routerState.pathname = "/mes-annonces";
    renderWithQuery(<RoleResumeGuard />);
    await new Promise((r) => setTimeout(r, 0));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("ramène au choix du rôle un compte connecté qui ne l’a jamais fait, puis vers sa page", async () => {
    session.set({ id: "google-1", email: "g@example.fr" });
    routerState.pathname = "/mes-annonces";
    renderWithQuery(<RoleResumeGuard />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/auth", search: { redirect: "/mes-annonces" }, replace: true }));
  });

  it("ne redirige pas un visiteur non connecté", async () => {
    routerState.pathname = "/mes-annonces";
    renderWithQuery(<RoleResumeGuard />);
    await new Promise((r) => setTimeout(r, 0));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("premier passage Google : un nouveau voyageur sans page d’origine arrive sur la recherche", async () => {
    session.set({ id: "google-3", email: "g3@example.fr" });
    renderWithQuery(<AuthPage />);
    await screen.findByRole("heading", { name: "Bienvenue sur PetInn" });
    fireEvent.click(screen.getByRole("button", { name: "Continuer" })); // Voyageur is preselected
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ href: "/recherche", replace: true }));
    expect(roles.get("google-3")).toBe("voyageur");
  });

  it("enregistre le rôle choisi à l’écran de bienvenue (compte Google) et renvoie vers la page d’origine", async () => {
    routerState.search = { redirect: "/mes-annonces" };
    session.set({ id: "google-2", email: "g2@example.fr" });
    renderWithQuery(<AuthPage />);
    await screen.findByRole("heading", { name: "Bienvenue sur PetInn" });
    fireEvent.click(screen.getByLabelText("Hôte"));
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ href: "/mes-annonces", replace: true }));
    expect(roles.get("google-2")).toBe("hote");
  });
});
