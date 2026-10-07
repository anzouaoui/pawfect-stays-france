import { createFileRoute } from "@tanstack/react-router";
import { LISTINGS } from "@/lib/data";
import { useRequests } from "@/lib/store";
import { RequestCard } from "@/components/RequestCard";

export const Route = createFileRoute("/mes-demandes")({
  head: () => ({
    meta: [
      { title: "Mes demandes de réservation — PetInn" },
      { name: "description", content: "Suivez l'état de vos demandes de réservation pet-friendly." },
      { property: "og:title", content: "Mes demandes — PetInn" },
      { property: "og:description", content: "Suivi de vos demandes de séjour avec votre chien." },
    ],
  }),
  component: Mine,
});

function Mine() {
  const [reqs] = useRequests();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Mes demandes</h1>
      <div className="mt-6 space-y-4">
        {reqs.map((r) => <RequestCard key={r.id} r={r} listing={LISTINGS.find((l) => l.id === r.listingId)!} />)}
        {!reqs.length && <p className="text-muted-foreground">Aucune demande pour le moment.</p>}
      </div>
    </div>
  );
}
