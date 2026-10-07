import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LISTINGS } from "@/lib/data";
import { useRequests } from "@/lib/store";
import { RequestCard } from "@/components/RequestCard";

export const Route = createFileRoute("/hote")({
  head: () => ({
    meta: [
      { title: "Espace hébergeur — PetInn" },
      { name: "description", content: "Gérez vos demandes de réservation et consultez les passeports canins des voyageurs." },
      { property: "og:title", content: "Espace hébergeur — PetInn" },
      { property: "og:description", content: "Acceptez ou refusez les demandes après avoir consulté le profil des chiens." },
    ],
  }),
  component: Host,
});

function Host() {
  const [reqs, setReqs] = useRequests();
  const [tab, setTab] = useState<"en attente" | "acceptée" | "refusée">("en attente");
  const set = (id: string, status: "acceptée" | "refusée") => setReqs(reqs.map((r) => (r.id === id ? { ...r, status } : r)));
  const list = reqs.filter((r) => r.status === tab);
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Espace hébergeur</h1>
      <p className="mt-1 text-muted-foreground">Consultez les passeports canins puis validez les demandes. Aucune commission côté hébergeur.</p>
      <div className="mt-6 flex gap-2">{(["en attente", "acceptée", "refusée"] as const).map((t) => (
        <button key={t} onClick={() => setTab(t)} className={`rounded-full border px-4 py-1.5 text-sm capitalize ${tab === t ? "bg-primary text-primary-foreground" : ""}`}>{t} ({reqs.filter((r) => r.status === t).length})</button>))}</div>
      <div className="mt-6 space-y-4">
        {list.map((r) => <RequestCard key={r.id} r={r} host listing={LISTINGS.find((l) => l.id === r.listingId)!}
          actions={r.status === "en attente" && <div className="mt-4 flex gap-2">
            <button onClick={() => set(r.id, "acceptée")} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">Accepter</button>
            <button onClick={() => set(r.id, "refusée")} className="rounded-xl border px-4 py-2 text-sm">Refuser</button></div>} />)}
        {!list.length && <p className="text-muted-foreground">Aucune demande ici.</p>}
      </div>
    </div>
  );
}
