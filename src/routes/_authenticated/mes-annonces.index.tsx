import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PHOTO_BUCKET, photoUrls, type HostListing } from "@/lib/host-listings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/mes-annonces/")({
  head: () => ({
    meta: [
      { title: "Mes annonces — PetInn" },
      { name: "description", content: "Gérez les logements pet-friendly que vous proposez sur PetInn." },
      { property: "og:title", content: "Mes annonces — PetInn" },
      { property: "og:description", content: "Vos logements publiés sur PetInn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyListings,
});

function MyListings() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-listings", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("host_listings").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return Promise.all(data.map(async (l) => ({ ...l, cover: (await photoUrls(l.photos.slice(0, 1)))[0] })));
    },
  });

  const toggle = async (l: HostListing) => {
    const status = l.status === "publiée" ? "brouillon" : "publiée";
    const { error } = await supabase.from("host_listings").update({ status }).eq("id", l.id);
    if (error) return toast.error("Mise à jour impossible.");
    qc.invalidateQueries({ queryKey: ["my-listings"] });
  };
  const remove = async (l: HostListing) => {
    if (!confirm(`Supprimer « ${l.name} » ?`)) return;
    const { error } = await supabase.from("host_listings").delete().eq("id", l.id);
    if (error) return toast.error("Suppression impossible.");
    if (l.photos.length) await supabase.storage.from(PHOTO_BUCKET).remove(l.photos);
    qc.invalidateQueries({ queryKey: ["my-listings"] });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Mes annonces</h1>
          <p className="mt-1 text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => supabase.auth.signOut()}>Se déconnecter</Button>
          <Button asChild><Link to="/mes-annonces/nouvelle">Ajouter un logement</Link></Button>
        </div>
      </div>
      <div className="mt-8 space-y-4">
        {isLoading && <p className="text-muted-foreground">Chargement…</p>}
        {error && <p className="text-destructive">Impossible de charger vos annonces.</p>}
        {data?.map((l) => (
          <div key={l.id} className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:flex-row">
            {l.cover ? <img src={l.cover} alt={l.name} className="h-32 w-full rounded-xl object-cover sm:w-44" /> : <div className="h-32 w-full rounded-xl bg-muted sm:w-44" />}
            <div className="flex-1">
              <div className="flex items-center gap-2"><h2 className="font-display text-lg font-bold">{l.name}</h2><Badge variant={l.status === "publiée" ? "default" : "secondary"}>{l.status}</Badge></div>
              <p className="text-sm text-muted-foreground">{l.type} · {l.city}{l.region ? `, ${l.region}` : ""}</p>
              <p className="mt-1 text-sm">{Number(l.price_per_night)} €/nuit · +{Number(l.dog_fee_per_night)} €/chien/nuit · {l.photos.length} photo(s) · {l.dog_rules && Array.isArray(l.dog_rules) ? l.dog_rules.length : 0} règle(s)</p>
              <p className="text-sm text-muted-foreground">Disponible du {new Date(l.available_from).toLocaleDateString("fr-FR")} au {new Date(l.available_to).toLocaleDateString("fr-FR")}{l.blocked_dates.length ? ` · ${l.blocked_dates.length} date(s) bloquée(s)` : ""}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => toggle(l)}>{l.status === "publiée" ? "Repasser en brouillon" : "Publier"}</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(l)}>Supprimer</Button>
              </div>
            </div>
          </div>
        ))}
        {data && !data.length && <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">Vous n'avez pas encore de logement. <Link to="/mes-annonces/nouvelle" className="underline">Ajoutez le premier</Link>.</div>}
      </div>
    </div>
  );
}
