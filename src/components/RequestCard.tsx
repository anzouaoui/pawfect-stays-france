import type { ReactNode } from "react";
import type { Listing } from "@/lib/data";
import type { BookingRequest } from "@/lib/store";
import { euros, hostPayout, type HostPayout } from "@/lib/payouts";

const badge = { "en attente": "bg-secondary", "acceptée": "bg-accent text-accent-foreground", "refusée": "bg-destructive text-destructive-foreground", "annulée": "bg-muted text-muted-foreground line-through", "expirée": "bg-muted text-muted-foreground" };

const payoutTone: Record<HostPayout["status"], string> = {
  demo: "bg-muted text-muted-foreground",
  payment_issue: "bg-destructive/10 text-destructive",
  scheduled: "bg-secondary",
  processing: "bg-accent/30",
  sent: "bg-muted text-muted-foreground",
};

/** Accepted booking, host side: net amount owed and payout status. */
function PayoutSummary({ p }: { p: HostPayout }) {
  return (
    <section aria-label="Versement hébergeur" className="mt-4 rounded-xl border p-4 text-sm">
      <dl className="space-y-1">
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Payé par le voyageur</dt><dd>{euros(p.total)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Frais de service PetInn (payés par le voyageur)</dt><dd>− {euros(p.fee)}</dd></div>
        <div className="flex justify-between gap-4 border-t pt-2 text-base font-semibold"><dt>Montant net qui vous est dû</dt><dd>{euros(p.net)}</dd></div>
      </dl>
      <p className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${payoutTone[p.status]}`}>{p.label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{p.detail}</p>
    </section>
  );
}

export function RequestCard({ r, listing, host, actions }: { r: BookingRequest; listing?: Listing | undefined; host?: boolean; actions?: ReactNode }) {
  const payout = host ? hostPayout(r) : null;
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h3 className="font-display text-lg font-semibold">{listing?.name ?? r.listingName ?? "Hébergement"}</h3>
          <p className="text-sm text-muted-foreground">{r.checkIn} → {r.checkOut} · {r.nights} nuit(s)</p></div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge[r.status]}`}>{r.status}</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {r.dogs.map((d) => (
          <div key={d.id} className="rounded-xl bg-secondary/60 p-3 text-sm">
            <p className="font-semibold">🐶 {d.name}</p><p className="text-muted-foreground">{d.breed} · {d.size} · {d.weight} kg</p>
            {d.behavior && <p className="mt-1">{d.behavior}</p>}
          </div>
        ))}
      </div>
      {r.message && <p className="mt-3 text-sm italic">« {r.message} »</p>}
      {host ? (
        payout ? <PayoutSummary p={payout} /> : (
          <p className="mt-3 text-sm">
            {r.status === "en attente" ? "Montant qui vous sera versé si vous acceptez" : "Montant du séjour"} : <b>{euros(r.subtotal)}</b> (aucune commission prélevée)
          </p>
        )
      ) : <p className="mt-3 text-sm">Total : <b>{euros(r.subtotal + r.fee)}</b> dont {euros(r.fee)} de frais de service</p>}
      {actions}
    </div>
  );
}
