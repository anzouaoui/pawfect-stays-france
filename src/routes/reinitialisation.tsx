import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reinitialisation")({
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — PetInn" },
      { name: "description", content: "Choisissez un nouveau mot de passe pour votre compte PetInn." },
      { property: "og:title", content: "Nouveau mot de passe — PetInn" },
      { property: "og:description", content: "Choisissez un nouveau mot de passe pour votre compte PetInn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

const schema = z
  .object({ password: z.string().min(8, "8 caractères minimum").max(72), confirm: z.string() })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Les mots de passe ne correspondent pas" });

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // The recovery link (code in the URL) is exchanged by the Supabase client
    // on load; re-check shortly after in case that exchange was still running.
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      setValid(Boolean(data.user));
      setChecking(false);
    };
    void check();
    const timer = setTimeout(check, 1500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message); return; }
    setBusy(true);
    // Recovery sessions are exempt from the current-password check.
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      setBusy(false);
      toast.error(error.status === 400 ? "Ce lien a expiré ou a déjà été utilisé. Demandez un nouveau lien." : "Modification impossible pour le moment. Réessayez.");
      return;
    }
    // Revoke the sessions on every other device; the current one stays signed in.
    await supabase.auth.signOut({ scope: "others" });
    setBusy(false);
    toast.success("Mot de passe modifié. Vous êtes connecté.");
    navigate({ href: "/mes-demandes" });
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-14">
      <h1 className="font-display text-3xl font-bold">Nouveau mot de passe</h1>
      {checking ? (
        <p className="mt-4 text-sm text-muted-foreground">Vérification du lien…</p>
      ) : valid ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">Choisissez un mot de passe d'au moins 8 caractères. Vos autres sessions seront déconnectées.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5"><Label htmlFor="password">Nouveau mot de passe</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} /></div>
            <div className="space-y-1.5"><Label htmlFor="confirm">Confirmer le mot de passe</Label><Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required minLength={8} /></div>
            <Button type="submit" className="w-full" disabled={busy}>Enregistrer le nouveau mot de passe</Button>
          </form>
        </>
      ) : (
        <>
          <p className="mt-4 rounded-lg border bg-card p-4 text-sm">Ce lien est invalide, a expiré ou a déjà été utilisé.</p>
          <Link to="/mot-de-passe-oublie" className="mt-4 block text-sm underline">Demander un nouveau lien</Link>
          <Link to="/auth" className="mt-2 block text-sm underline">Retour à la connexion</Link>
        </>
      )}
    </div>
  );
}
