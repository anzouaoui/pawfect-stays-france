import { useEffect, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { getStripeKey } from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";

let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = () => (stripePromise ??= getStripeKey().then(({ key }) => (key ? loadStripe(key) : null)));

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
  const [ready, setReady] = useState(false);
  useEffect(() => { getStripe().then((s) => setReady(!!s)); }, []);
  if (!ready) return <p className="mt-4 text-sm text-muted-foreground">Chargement du paiement…</p>;
  return <Elements stripe={getStripe()} options={{ clientSecret, locale: "fr" }}><Inner total={total} onDone={onDone} /></Elements>;
}
