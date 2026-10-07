import type { ReactNode } from "react";
import type { Listing } from "@/lib/data";
import type { BookingRequest } from "@/lib/store";

const badge = { "en attente": "bg-secondary", "acceptée": "bg-accent text-accent-foreground", "refusée": "bg-destructive text-destructive-foreground" };

export function RequestCard({ r, listing, host, actions }: { r: BookingRequest; listing: Listing; host?: boolean; actions?: ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h3 className="font-display text-lg font-semibold">{listing.name}</h3>
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
      <p className="mt-3 text-sm">{host ? <>Versement hébergeur : <b>{r.subtotal} €</b> (aucune commission prélevée)</> : <>Total : <b>{r.subtotal + r.fee} €</b> dont {r.fee} € de frais de service</>}</p>
      {actions}
    </div>
  );
}
