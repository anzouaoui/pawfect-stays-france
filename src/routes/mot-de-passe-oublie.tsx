import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/mot-de-passe-oublie")({
  head: () => ({
    meta: [
      { title: "Mot de passe oublié — PetInn" },
      { name: "description", content: "Recevez un e-mail pour réinitialiser le mot de passe de votre compte PetInn." },
      { property: "og:title", content: "Mot de passe oublié — PetInn" },
      { property: "og:description", content: "Recevez un e-mail pour réinitialiser le mot de passe de votre compte PetInn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForgotPasswordPage,
});

const schema = z.object({ email: z.string().trim().email("Email invalide").max(255) });

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message); return; }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/reinitialisation`,
    });
    setBusy(false);
    if (error) { toast.error("Envoi impossible pour le moment. Réessayez plus tard."); return; }
    setSent(true);
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-14">
      <h1 className="font-display text-3xl font-bold">Mot de passe oublié</h1>
      <p className="mt-1 text-sm text-muted-foreground">Nous vous envoyons un lien pour choisir un nouveau mot de passe.</p>
      {sent ? (
        <div className="mt-6 rounded-lg border bg-card p-4 text-sm">
          <p>Si un compte existe pour cet email, un lien de réinitialisation vous parvient dans quelques minutes. Pensez à vérifier vos spams.</p>
          <p className="mt-2 text-muted-foreground">Le lien est valable une seule fois et expire rapidement.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></div>
          <Button type="submit" className="w-full" disabled={busy}>Envoyer le lien</Button>
        </form>
      )}
      <Link to="/auth" className="mt-4 block text-sm underline">Retour à la connexion</Link>
    </div>
  );
}
