import { useEffect, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { getStripeKey } from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";

const UNAVAILABLE = "Le service de paiement est momentanément indisponible. Réessayez dans quelques minutes.";

let stripePromise: Promise<Stripe> | null = null;
/** Loads Stripe.js once. Rejects with a user-safe message; a failed attempt is not cached so it can be retried. */
const getStripe = () =>
  (stripePromise ??= getStripeKey()
    .then(async (res) => {
      if (!res.key) throw new Error("error" in res ? res.error : UNAVAILABLE);
      const stripe = await loadStripe(res.key);
      if (!stripe) throw new Error(UNAVAILABLE);
      return stripe;
    })
    .catch((e: unknown) => {
      stripePromise = null;
      throw e instanceof Error && e.message ? e : new Error(UNAVAILABLE);
    }));

function Inner({ total, onDone }: { total: number; onDone: () => Promise<void> }) {
  const stripe = useStripe(); const elements = useElements();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const pay = async () => {
    if (!stripe || !elements) return;
    setBusy(true); setErr("");
    const { error } = await stripe.confirmPayment({ elements, redirect: "if_required" });
    if (error) { setErr(error.message ?? "Carte refusée"); setBusy(false); return; }
    try { await onDone(); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  return (
    <div className="mt-4 space-y-3">
      <PaymentElement />
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button disabled={!stripe || busy} onClick={pay} className="h-12 w-full bg-accent font-semibold text-accent-foreground hover:bg-accent/90">{busy ? "Vérification…" : `Bloquer ${total} € sur ma carte`}</Button>
      <p className="text-center text-xs text-muted-foreground">Empreinte bancaire uniquement : débit seulement si l’hôte accepte, libérée sinon.</p>
    </div>
  );
}

export function CardHoldForm({ clientSecret, total, onDone }: { clientSecret: string; total: number; onDone: () => Promise<void> }) {
  const [state, setState] = useState<{ stripe: Stripe } | { error: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState(null);
    getStripe().then(
      (stripe) => { if (active) setState({ stripe }); },
      (e: Error) => { if (active) setState({ error: e.message || UNAVAILABLE }); },
    );
    return () => { active = false; };
  }, [attempt]);
  if (!state) return <p className="mt-4 text-sm text-muted-foreground">Chargement du paiement…</p>;
  if ("error" in state) {
    return (
      <div role="alert" className="mt-4 space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
        <p className="text-destructive">{state.error}</p>
        <p className="text-muted-foreground">Votre carte n’a pas été débitée.</p>
        <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>Réessayer</Button>
      </div>
    );
  }
  return <Elements stripe={state.stripe} options={{ clientSecret, locale: "fr" }}><Inner total={total} onDone={onDone} /></Elements>;
}
