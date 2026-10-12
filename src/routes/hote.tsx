import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { LISTINGS } from "@/lib/data";
import { useRequests, type BookingRequest } from "@/lib/store";
import { RequestCard } from "@/components/RequestCard";
import { supabase } from "@/integrations/supabase/client";
import { toRequest, useLiveRequests, useSessionUser } from "@/lib/booking-requests";

export const Route = createFileRoute("/hote")({
  head: () => ({
    meta: [
      { title: "Espace hébergeur — PetInn" },
      { name: "description", content: "Gérez vos demandes de réservation et consultez les passeports canins des voyageurs." },
      { property: "og:title", content: "Espace hébergeur — PetInn" },
      { property: "og:description", content: "Acceptez ou refusez les demandes après avoir consulté le profil des chiens." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Host,
});

type Status = BookingRequest["status"];

function Host() {
  const [local, setLocal] = useRequests();
  const user = useSessionUser();
  const { rows } = useLiveRequests(user, "host");
  const [tab, setTab] = useState<Status>("en attente");
  const live = (rows ?? []).map((r) => ({ ...toRequest(r), live: true as const }));
  const all = [...live, ...local.map((r) => ({ ...r, live: false as const }))];
  const list = all.filter((r) => r.status === tab);

  const decide = async (r: (typeof all)[number], status: "acceptée" | "refusée") => {
    if (!r.live) { setLocal(local.map((x) => (x.id === r.id ? { ...x, status } : x))); return; }
    const { error } = await supabase.from("booking_requests").update({ status }).eq("id", r.id);
    if (error) toast.error("Mise à jour impossible."); else toast.success(status === "acceptée" ? "Demande acceptée" : "Demande refusée");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Espace hébergeur</h1>
      <p className="mt-1 text-muted-foreground">Consultez les passeports canins puis validez les demandes. Aucune commission côté hébergeur.</p>
      {user === null && <p className="mt-4 rounded-2xl border bg-card p-4 text-sm"><Link to="/auth" search={{ redirect: "/hote" }} className="font-semibold underline">Connectez-vous</Link> pour recevoir les demandes envoyées sur vos annonces.</p>}
      <div className="mt-6 flex flex-wrap gap-2">{(["en attente", "acceptée", "refusée"] as const).map((t) => (
        <button key={t} onClick={() => setTab(t)} className={`rounded-full border px-4 py-1.5 text-sm capitalize ${tab === t ? "bg-primary text-primary-foreground" : ""}`}>{t} ({all.filter((r) => r.status === t).length})</button>))}</div>
      <div className="mt-6 space-y-4">
        {list.map((r) => <RequestCard key={r.id} r={r} host listing={LISTINGS.find((l) => l.id === r.listingId)}
          actions={r.status === "en attente" && <div className="mt-4 flex gap-2">
            <button onClick={() => decide(r, "acceptée")} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">Accepter</button>
            <button onClick={() => decide(r, "refusée")} className="rounded-xl border px-4 py-2 text-sm">Refuser</button></div>} />)}
        {!list.length && <p className="text-muted-foreground">Aucune demande ici.</p>}
      </div>
    </div>
  );
}
