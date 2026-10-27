import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { photoUrls } from "@/lib/host-listings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/mes-voyages")({
  head: () => ({
    meta: [
      { title: "Mes voyages — PetInn" },
      { name: "description", content: "Le résumé de vos séjours et de vos logements pet-friendly sur PetInn." },
      { property: "og:title", content: "Mes voyages — PetInn" },
      { property: "og:description", content: "Résumé de vos séjours et logements PetInn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyTrips,
});

function MyTrips() {
  const { user } = Route.useRouteContext();
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-trips", user.id],
    queryFn: async () => {
      const [l, r] = await Promise.all([
        supabase.from("host_listings").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
        supabase.from("booking_requests").select("*").eq("traveler_id", user.id).order("check_in", { ascending: false }),
      ]);
      if (l.error) throw l.error;
      if (r.error) throw r.error;
      const listings = await Promise.all(l.data.map(async (x) => ({ ...x, cover: (await photoUrls(x.photos.slice(0, 1)))[0] })));
      return { listings, requests: r.data };
    },
  });

  const published = data?.listings.filter((l) => l.status === "publiée").length ?? 0;
  const drafts = (data?.listings.length ?? 0) - published;
  const upcoming = data?.requests.filter((r) => r.status === "acceptée").length ?? 0;
  const pending = data?.requests.filter((r) => r.status === "en attente").length ?? 0;
  const fr = (d: string) => new Date(d).toLocaleDateString("fr-FR");

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <div>
        <h1 className="font-display text-3xl font-bold">Mes voyages</h1>
        <p className="mt-1 text-muted-foreground">{user.email}</p>
      </div>
      {isLoading && <p className="text-muted-foreground">Chargement…</p>}
      {error && <p className="text-destructive">Impossible de charger votre résumé.</p>}
      {data && <>
        <section aria-labelledby="resume" className="space-y-3">
          <h2 id="resume" className="font-display text-xl font-bold">Résumé</h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Séjours confirmés", upcoming], ["Demandes en attente", pending], ["Logements publiés", published], ["Brouillons", drafts]].map(([k, v]) => (
              <div key={k} className="rounded-2xl border bg-card p-4"><dt className="text-sm text-muted-foreground">{k}</dt><dd className="font-display text-2xl font-bold">{v}</dd></div>
            ))}
          </dl>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">Mes séjours</h2>
          {data.requests.length ? data.requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-4">
              <div><p className="font-semibold">{r.listing_name}</p><p className="text-sm text-muted-foreground">Du {fr(r.check_in)} au {fr(r.check_out)} · {r.nights} nuit(s)</p></div>
              <div className="flex items-center gap-2"><Badge variant="secondary">{r.status}</Badge>
                <Button size="sm" variant="outline" asChild><Link to="/hebergement/$id" params={{ id: r.listing_id }}>Voir le logement</Link></Button></div>
            </div>
          )) : <p className="text-muted-foreground">Aucun séjour pour le moment. <Link to="/recherche" className="underline">Trouver un logement</Link>.</p>}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">Mes logements</h2>
          {data.listings.length ? data.listings.map((l) => (
            <div key={l.id} className="flex items-center gap-4 rounded-2xl border bg-card p-3">
              {l.cover ? <img src={l.cover} alt={l.name} className="h-16 w-24 rounded-lg object-cover" /> : <div className="h-16 w-24 rounded-lg bg-muted" />}
              <div className="flex-1"><p className="font-semibold">{l.name || "Brouillon sans titre"}</p><p className="text-sm text-muted-foreground">{l.type} · {l.city}</p></div>
              <Badge variant={l.status === "publiée" ? "default" : "secondary"}>{l.status}</Badge>
              {l.status === "publiée"
                ? <Button size="sm" asChild><Link to="/hebergement/$id" params={{ id: l.id }}>Ouvrir l'annonce</Link></Button>
                : <Button size="sm" variant="outline" asChild><Link to="/mes-annonces/nouvelle" search={{ id: l.id }}>Continuer</Link></Button>}
            </div>
          )) : <p className="text-muted-foreground">Aucun logement. <Link to="/mes-annonces/nouvelle" search={{}} className="underline">Ajouter un logement</Link>.</p>}
        </section>
      </>}
    </div>
  );
}
