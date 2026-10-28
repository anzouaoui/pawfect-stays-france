import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSessionUser } from "@/lib/booking-requests";
import { readAccountRole, saveFirstAccountRole } from "@/lib/auth-account";
import {
  AUTH_REDIRECT_KEY,
  SIGNUP_ROLE_KEY,
  destinationForRole,
  isAppRole,
  safePath,
  type AppRole,
} from "@/lib/auth-redirect";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => (safePath(s["redirect"]) ? { redirect: safePath(s["redirect"]) } : {}),
  head: () => ({
    meta: [
      { title: "Connexion — PetInn" },
      { name: "description", content: "Connectez-vous pour réserver, suivre vos demandes ou publier vos logements pet-friendly sur PetInn." },
      { property: "og:title", content: "Connexion — PetInn" },
      { property: "og:description", content: "Réservez ou publiez vos logements pet-friendly sur PetInn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({ email: z.string().trim().email("Email invalide").max(255), password: z.string().min(8, "8 caractères minimum").max(72) });

function AuthPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [role, setRole] = useState<AppRole>("voyageur");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"checking" | "signin" | "role" | "error">("checking");
  const [retry, setRetry] = useState(0);
  const user = useSessionUser();
  const search = Route.useSearch();

  const go = (savedRole: AppRole) => {
    const dest = safePath(search.redirect) || safePath(localStorage.getItem(AUTH_REDIRECT_KEY));
    localStorage.removeItem(AUTH_REDIRECT_KEY);
    navigate({ href: dest || destinationForRole(savedRole), replace: true });
  };

  useEffect(() => {
    if (search.redirect) localStorage.setItem(AUTH_REDIRECT_KEY, search.redirect);
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("error") || new URLSearchParams(window.location.search).has("error")) {
      toast.error("Connexion Google annulée ou impossible. Vous pouvez réessayer.");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [search.redirect]);

  useEffect(() => {
    if (user === undefined) return;
    if (!user) { setStage("signin"); return; }
    let active = true;
    setStage("checking");
    const resolve = async () => {
      try {
        let savedRole = await readAccountRole(user.id);
        const key = `${SIGNUP_ROLE_KEY}:${user.id}`;
        const pending = localStorage.getItem(key);
        if (!savedRole && isAppRole(pending)) savedRole = await saveFirstAccountRole(user.id, pending);
        if (!active) return;
        if (!savedRole) { setStage("role"); return; }
        localStorage.removeItem(key);
        go(savedRole);
      } catch {
        if (active) setStage("error");
      }
    };
    void resolve();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user === undefined, retry]);

  const chooseRole = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || data.user?.id !== user.id) throw new Error("Session expirée");
      const saved = await saveFirstAccountRole(user.id, role);
      localStorage.removeItem(`${SIGNUP_ROLE_KEY}:${user.id}`);
      queryClient.setQueryData(["account-role", user.id], saved);
      go(saved);
    } catch {
      toast.error("Impossible d’enregistrer votre choix. Réessayez.");
    } finally { setBusy(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message); return; }
    setBusy(true);
    try { if (mode === "up") {
      const { data, error } = await supabase.auth.signUp({ ...parsed.data, options: { emailRedirectTo: window.location.origin + "/auth" } });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      if (data.user) localStorage.setItem(`${SIGNUP_ROLE_KEY}:${data.user.id}`, role);
      if (data.session) { setRetry((value) => value + 1); return; }
      toast.success("Vérifiez votre boîte mail pour confirmer votre compte.");
    } else {
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      setBusy(false);
      if (error) { toast.error("Email ou mot de passe incorrect."); return; }
      setRetry((value) => value + 1);
    }
    } catch { toast.error("Connexion impossible. Réessayez."); }
    finally { setBusy(false); }
  };

  const google = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
      if (result.error) { toast.error("Connexion Google impossible ou annulée. Réessayez."); return; }
      if (result.redirected) return;
      setRetry((value) => value + 1);
    } catch { toast.error("Connexion Google impossible. Réessayez."); }
    finally { setBusy(false); }
  };

  if (stage === "checking") return <div className="mx-auto max-w-sm px-4 py-14" role="status">Connexion en cours…</div>;
  if (stage === "error") return <div className="mx-auto max-w-sm space-y-4 px-4 py-14"><h1 className="font-display text-3xl font-bold">Connexion interrompue</h1><p className="text-muted-foreground">Votre type de compte n’a pas pu être chargé.</p><Button onClick={() => setRetry((value) => value + 1)}>Réessayer</Button></div>;
  if (stage === "role") return (
    <div className="mx-auto max-w-sm px-4 py-14">
      <h1 className="font-display text-3xl font-bold">Bienvenue sur PetInn</h1>
      <fieldset disabled={busy} className="mt-6 space-y-4">
        <legend className="mb-3 font-medium">Votre type de compte</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["voyageur", "hote"] as const).map((value) => <Label key={value} className="flex cursor-pointer items-center gap-2 rounded-md border p-4"><input type="radio" name="account-role" value={value} checked={role === value} onChange={() => setRole(value)} />{value === "hote" ? "Hôte" : "Voyageur"}</Label>)}
        </div>
        <Button className="w-full" onClick={chooseRole}>{busy ? "Enregistrement…" : "Continuer"}</Button>
      </fieldset>
    </div>
  );

  return (
    <div className="mx-auto max-w-sm px-4 py-14">
      <h1 className="font-display text-3xl font-bold">{mode === "in" ? "Connexion" : "Créer un compte"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Pour suivre vos demandes de séjour ou publier vos logements.</p>
      <Button variant="outline" className="mt-6 w-full" onClick={google} disabled={busy}>Continuer avec Google</Button>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === "up" && (
          <div className="space-y-1.5">
            <Label>Je m'inscris comme</Label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Type de compte">
              <Button type="button" variant={role === "voyageur" ? "default" : "outline"} onClick={() => setRole("voyageur")} aria-pressed={role === "voyageur"}>Voyageur</Button>
              <Button type="button" variant={role === "hote" ? "default" : "outline"} onClick={() => setRole("hote")} aria-pressed={role === "hote"}>Hôte</Button>
            </div>
          </div>
        )}
        <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
        <div className="space-y-1.5"><Label htmlFor="pw">Mot de passe</Label><Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} /></div>
        {mode === "in" && <Link to="/mot-de-passe-oublie" className="block text-right text-sm text-muted-foreground underline">Mot de passe oublié ?</Link>}
        <Button type="submit" className="w-full" disabled={busy}>{mode === "in" ? "Se connecter" : "Créer mon compte"}</Button>
      </form>
      <Button variant="link" className="mt-4 h-auto whitespace-normal px-0 text-sm" disabled={busy} onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "Pas encore de compte ? Inscrivez-vous" : "Déjà inscrit ? Connectez-vous"}</Button>
    </div>
  );
}
