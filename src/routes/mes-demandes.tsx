import { createFileRoute, Link } from "@tanstack/react-router";
import { LISTINGS } from "@/lib/data";
import { useRequests } from "@/lib/store";
import { RequestCard } from "@/components/RequestCard";
import { toRequest, useLiveRequests, useSessionUser } from "@/lib/booking-requests";

export const Route = createFileRoute("/mes-demandes")({
  head: () => ({
    meta: [
      { title: "Mes demandes de réservation — PetInn" },
      { name: "description", content: "Suivez en temps réel l'état de vos demandes de réservation pet-friendly." },
      { property: "og:title", content: "Mes demandes — PetInn" },
      { property: "og:description", content: "Suivi en direct de vos demandes de séjour avec votre chien." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Mine,
});

function Mine() {
  const [local] = useRequests();
  const user = useSessionUser();
  const { rows, error } = useLiveRequests(user, "traveler");
  const live = rows?.map(toRequest) ?? [];
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold">Mes demandes</h1>
        {user && <span className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground"><span className="size-2 animate-pulse rounded-full bg-accent" />Statut mis à jour en direct</span>}
      </div>
      {user === null && (
        <div className="mt-6 rounded-2xl border bg-card p-5 text-sm">
          <Link to="/auth" search={{ redirect: "/mes-demandes" }} className="font-semibold underline">Connectez-vous</Link> pour suivre en direct les réponses des hôtes.
        </div>
      )}
      {error && <p className="mt-6 text-destructive">Impossible de charger vos demandes.</p>}
      <div className="mt-6 space-y-4">
        {live.map((r) => <RequestCard key={r.id} r={r} />)}
        {local.map((r) => <RequestCard key={r.id} r={r} listing={LISTINGS.find((l) => l.id === r.listingId)} />)}
        {user !== undefined && !live.length && !local.length && <p className="text-muted-foreground">Aucune demande pour le moment.</p>}
      </div>
    </div>
  );
}
