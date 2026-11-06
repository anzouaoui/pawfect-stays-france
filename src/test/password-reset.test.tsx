import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

vi.mock("@tanstack/react-router", async () => (await import("./auth-harness")).routerMock);
vi.mock("@/integrations/supabase/client", async () => ({ supabase: (await import("./auth-harness")).supabase }));
vi.mock("sonner", async () => ({ toast: (await import("./auth-harness")).toast }));

import { auth, navigate, pageOf, resetAuthHarness, roles, session, toast } from "./auth-harness";
import { Route as ForgotRoute } from "@/routes/mot-de-passe-oublie";
import { Route as ResetRoute } from "@/routes/reinitialisation";

const ForgotPage = pageOf(ForgotRoute);
const ResetPage = pageOf(ResetRoute);
const errors = vi.spyOn(console, "error");
const warnings = vi.spyOn(console, "warn");

beforeEach(() => { resetAuthHarness(); errors.mockClear(); warnings.mockClear(); });
afterEach(() => {
  cleanup();
  expect(errors).not.toHaveBeenCalled();
  expect(warnings).not.toHaveBeenCalled();
});

describe("Mot de passe oublié (/mot-de-passe-oublie)", () => {
  const send = (email: string) => {
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer le lien" }));
  };

  it("envoie le lien de réinitialisation vers /reinitialisation", async () => {
    render(<ForgotPage />);
    send("anouk@example.fr");
    await screen.findByText(/Si un compte existe pour cet email/);
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("anouk@example.fr", { redirectTo: "http://localhost:3000/reinitialisation" });
    expect(screen.queryByRole("button", { name: "Envoyer le lien" })).toBeNull();
  });

  it("affiche le même message neutre que le compte existe ou non (pas de divulgation)", async () => {
    render(<ForgotPage />);
    send("inconnu@example.fr");
    expect(await screen.findByText(/Si un compte existe pour cet email, un lien de réinitialisation vous parvient/)).toBeInTheDocument();
    expect(screen.getByText(/valable une seule fois et expire rapidement/)).toBeInTheDocument();
  });

  it("refuse un e-mail invalide sans appeler Supabase", async () => {
    render(<ForgotPage />);
    send("anouk@example");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Email invalide"));
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("signale un échec d’envoi et laisse réessayer", async () => {
    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { message: "rate limit" } as never });
    render(<ForgotPage />);
    send("anouk@example.fr");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Envoi impossible pour le moment. Réessayez plus tard."));
    expect(screen.getByRole("button", { name: "Envoyer le lien" })).toBeEnabled();
  });

  it("propose le retour à la connexion", () => {
    render(<ForgotPage />);
    expect(screen.getByRole("link", { name: "Retour à la connexion" })).toHaveAttribute("href", "/auth");
  });
});

describe("Nouveau mot de passe (/reinitialisation)", () => {
  const choose = (password: string, confirm: string) => {
    fireEvent.change(screen.getByLabelText("Nouveau mot de passe"), { target: { value: password } });
    fireEvent.change(screen.getByLabelText("Confirmer le mot de passe"), { target: { value: confirm } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le nouveau mot de passe" }));
  };

  it("indique un lien invalide ou expiré quand aucune session de récupération n’existe", async () => {
    render(<ResetPage />);
    expect(await screen.findByText("Ce lien est invalide, a expiré ou a déjà été utilisé.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Demander un nouveau lien" })).toHaveAttribute("href", "/mot-de-passe-oublie");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("refuse des mots de passe différents ou trop courts", async () => {
    session.set({ id: "traveler-1", email: "t@example.fr" });
    render(<ResetPage />);
    await screen.findByLabelText("Nouveau mot de passe");
    choose("nouveaumdp1", "nouveaumdp2");
    expect(toast.error).toHaveBeenLastCalledWith("Les mots de passe ne correspondent pas");
    // minLength is enforced by the browser too; submit the form directly to reach the app's check.
    fireEvent.change(screen.getByLabelText("Nouveau mot de passe"), { target: { value: "court" } });
    fireEvent.change(screen.getByLabelText("Confirmer le mot de passe"), { target: { value: "court" } });
    fireEvent.submit(screen.getByRole("button", { name: "Enregistrer le nouveau mot de passe" }).closest("form")!);
    expect(toast.error).toHaveBeenLastCalledWith("8 caractères minimum");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it.each([
    ["voyageur", "/mes-demandes"],
    ["hote", "/mes-annonces"],
  ])("met à jour le mot de passe, déconnecte les autres appareils et renvoie le %s vers %s", async (role, dest) => {
    session.set({ id: "user-1", email: "u@example.fr" });
    roles.set("user-1", role);
    render(<ResetPage />);
    await screen.findByLabelText("Nouveau mot de passe");
    choose("nouveaumdp1", "nouveaumdp1");

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ href: dest }));
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "nouveaumdp1" });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "others" });
    expect(toast.success).toHaveBeenCalledWith("Mot de passe modifié. Vous êtes connecté.");
    expect(roles.get("user-1")).toBe(role);
  });

  it("explique qu’un lien déjà utilisé ou expiré doit être redemandé", async () => {
    session.set({ id: "user-2", email: "u2@example.fr" });
    auth.updateUser.mockResolvedValueOnce({ error: { status: 400, message: "expired" } as never });
    render(<ResetPage />);
    await screen.findByLabelText("Nouveau mot de passe");
    choose("nouveaumdp1", "nouveaumdp1");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Ce lien a expiré ou a déjà été utilisé. Demandez un nouveau lien."));
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
