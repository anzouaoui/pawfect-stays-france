import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { LISTINGS } from "@/lib/data";
import { Bath, Bed, Check, Dog, Fence, PawPrint, ShieldCheck, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListingGallery } from "@/components/ListingGallery";
import { getPublishedListing } from "@/lib/public-listings.functions";

export const Route = createFileRoute("/hebergement/$id")({
  loader: async ({ params }) => {
    const l = LISTINGS.find((x) => x.id === params.id)
      ?? (/^[0-9a-f-]{36}$/i.test(params.id) ? await getPublishedListing({ data: { id: params.id } }) : null);
    if (!l) throw notFound();
    return l;
  },
  errorComponent: () => <p className="p-10 text-center">Impossible de charger cet hébergement.</p>,
  head: ({ loaderData: l }) => l ? {
    meta: [
      { title: `${l.name} à ${l.city} — PetInn` },
      { name: "description", content: l.description },
      { property: "og:title", content: `${l.name} — ${l.type} pet-friendly` },
      { property: "og:description", content: l.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  } : { meta: [
    { title: "Hébergement introuvable — PetInn" },
    { name: "description", content: "Cet hébergement PetInn n’est pas disponible." },
    { property: "og:title", content: "Hébergement introuvable — PetInn" },
    { property: "og:description", content: "Cet hébergement PetInn n’est pas disponible." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "noindex" },
  ] },
  notFoundComponent: () => <p className="p-10 text-center">Hébergement introuvable.</p>,
  component: Detail,
});

function Detail() {
  const l = Route.useLoaderData();
  const h = l.hosted;


  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link to="/recherche" search={{ q: "", type: "", from: "", to: "" }} className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">← Retour aux hébergements</Link>
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">{l.type} · {l.city}{l.region ? `, ${l.region}` : ""} · {l.rating ? `★ ${l.rating}` : "Nouveau"}</p>
        <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">{l.name}</h1>
      </div>
      <ListingGallery key={l.id} photos={l.photos} name={l.name} illustrative={!h} />
      <div className="mt-8 grid gap-10 md:grid-cols-[1fr_380px]">
        <div>
          <p className="text-lg leading-relaxed">{l.description}</p>
          <h2 className="mt-8 font-display text-xl font-semibold">Accueil des chiens</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            <li className="flex items-center gap-3 py-2"><Fence className="size-5 shrink-0 text-primary" />{l.fencedGarden ? "Jardin clôturé" : "Pas de jardin clôturé"}</li>
            <li className="flex items-center gap-3 py-2"><Dog className="size-5 shrink-0 text-primary" />Gabarits : {l.sizes.join(", ")}</li>
            <li className="flex items-center gap-3 py-2"><PawPrint className="size-5 shrink-0 text-primary" />Jusqu'à {l.maxDogs} chien{l.maxDogs > 1 ? "s" : ""}</li>
            <li className="flex items-center gap-3 py-2"><ShieldCheck className="size-5 shrink-0 text-primary" />Accueil confirmé par {l.host}</li>
          </ul>
          <section className="mt-8 border-t pt-7" aria-labelledby="dog-equipment">
            <h2 id="dog-equipment" className="font-display text-xl font-semibold">Équipements adaptés aux chiens</h2>
            <ul className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
              {l.dogEquipment.map((item) => {
                const Icon = item.title === "Panier" ? Bed : item.title === "Douche pour chien" ? Bath : item.title === "Plage à proximité" ? Waves : Check;
                return <li key={item.title} className="flex items-start gap-3"><Icon className="mt-1 size-5 shrink-0 text-primary" /><div><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p></div></li>;
              })}
            </ul>
          </section>
          <section className="mt-8 border-t pt-7" aria-labelledby="dog-rules">
            <h2 id="dog-rules" className="flex items-center gap-2 font-display text-xl font-semibold"><ShieldCheck className="size-5 text-primary" />Règles d’accueil des chiens</h2>
            <p className="mt-2 text-sm text-muted-foreground">{h ? "Règles fixées par l’hébergeur." : "Conditions d’exemple, à confirmer par l’hébergeur avant toute réservation."}</p>
            <dl className="mt-5 divide-y">
              {l.dogRules.map((rule) => <div key={rule.title} className="py-4 first:pt-0"><dt className="font-semibold">{rule.title}</dt><dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{rule.description}</dd></div>)}
            </dl>
          </section>
        </div>
        <aside className="h-fit rounded-2xl border bg-card p-5 shadow-sm md:sticky md:top-20">
          <p><span className="text-2xl font-bold">{l.price} €</span> / nuit</p>
          {h && <div className="mt-2 space-y-0.5 text-sm text-muted-foreground">
            {h.dogFee > 0 && <p>+ {h.dogFee} € par chien et par nuit</p>}
            {h.cleaningFee > 0 && <p>Frais de ménage : {h.cleaningFee} €</p>}
            <p>Séjour minimum : {h.minNights} nuit{h.minNights > 1 ? "s" : ""}</p>
            <p>Ouvert du {new Date(h.availableFrom).toLocaleDateString("fr-FR")} au {new Date(h.availableTo).toLocaleDateString("fr-FR")}</p>
          </div>}
          <Button asChild className="mt-4 h-12 w-full bg-accent font-semibold text-accent-foreground hover:bg-accent/90"><Link to="/reserver/$id" params={{ id: l.id }}>Réserver</Link></Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">Paiement sécurisé · débité seulement après acceptation de l’hôte.</p>
        </aside>
      </div>
    </div>
  );
}
