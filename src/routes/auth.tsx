import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion hébergeur — PetInn" },
      { name: "description", content: "Connectez-vous pour publier et gérer vos logements pet-friendly sur PetInn." },
      { property: "og:title", content: "Connexion hébergeur — PetInn" },
      { property: "og:description", content: "Publiez vos logements pet-friendly sur PetInn." },
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message); return; }
    setBusy(true);
    if (mode === "up") {
      const { error } = await supabase.auth.signUp({ ...parsed.data, options: { emailRedirectTo: window.location.origin + "/mes-annonces" } });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Vérifiez votre boîte mail pour confirmer votre compte.");
    } else {
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      setBusy(false);
      if (error) { toast.error("Email ou mot de passe incorrect."); return; }
      navigate({ to: "/mes-annonces" });
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (result.error) { toast.error("Connexion Google impossible."); return; }
    if (result.redirected) return;
    navigate({ to: "/mes-annonces" });
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-14">
      <h1 className="font-display text-3xl font-bold">{mode === "in" ? "Connexion hébergeur" : "Créer un compte hébergeur"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Pour publier et gérer vos logements.</p>
      <Button variant="outline" className="mt-6 w-full" onClick={google}>Continuer avec Google</Button>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
        <div className="space-y-1.5"><Label htmlFor="pw">Mot de passe</Label><Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} /></div>
        <Button type="submit" className="w-full" disabled={busy}>{mode === "in" ? "Se connecter" : "Créer mon compte"}</Button>
      </form>
      <button className="mt-4 text-sm underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "Pas encore de compte ? Inscrivez-vous" : "Déjà inscrit ? Connectez-vous"}</button>
    </div>
  );
}
