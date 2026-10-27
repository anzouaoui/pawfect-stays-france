import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [mode, setMode] = useState<"in" | "up">("in");
  const [role, setRole] = useState<AppRole>("voyageur");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const search = Route.useSearch();

  const go = async () => {
    const dest = safePath(search.redirect) || safePath(localStorage.getItem(AUTH_REDIRECT_KEY));
    localStorage.removeItem(AUTH_REDIRECT_KEY);
    const { data: userData } = await supabase.auth.getUser();
    const pending = localStorage.getItem(SIGNUP_ROLE_KEY);
    if (isAppRole(pending)) {
      localStorage.removeItem(SIGNUP_ROLE_KEY);
      if (userData.user) {
        await supabase.from("user_roles").upsert(
          { user_id: userData.user.id, role: pending },
          { onConflict: "user_id", ignoreDuplicates: true },
        );
      }
    }
    if (dest) { navigate({ href: dest }); return; }
    if (!userData.user) { navigate({ href: destinationForRole("voyageur") }); return; }
    let roleValue: string | null = isAppRole(pending) ? pending : null;
    if (!roleValue) {
      const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", userData.user.id).maybeSingle();
      roleValue = roleRow?.role ?? null;
    }
    navigate({ href: destinationForRole(roleValue) });
  };

  useEffect(() => {
    if (search.redirect) localStorage.setItem(AUTH_REDIRECT_KEY, search.redirect);
    supabase.auth.getSession().then(({ data }) => { if (data.session) go(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message); return; }
    setBusy(true);
    if (mode === "up") {
      const { data, error } = await supabase.auth.signUp({ ...parsed.data, options: { emailRedirectTo: window.location.origin + "/auth" } });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      if (data.user) localStorage.setItem(SIGNUP_ROLE_KEY, role);
      if (data.session) { await go(); return; }
      toast.success("Vérifiez votre boîte mail pour confirmer votre compte.");
    } else {
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      setBusy(false);
      if (error) { toast.error("Email ou mot de passe incorrect."); return; }
      await go();
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (result.error) { toast.error("Connexion Google impossible."); return; }
    if (result.redirected) return;
    await go();
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-14">
      <h1 className="font-display text-3xl font-bold">{mode === "in" ? "Connexion" : "Créer un compte"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Pour suivre vos demandes de séjour ou publier vos logements.</p>
      <Button variant="outline" className="mt-6 w-full" onClick={google}>Continuer avec Google</Button>
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
      <button className="mt-4 text-sm underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "Pas encore de compte ? Inscrivez-vous" : "Déjà inscrit ? Connectez-vous"}</button>
    </div>
  );
}
