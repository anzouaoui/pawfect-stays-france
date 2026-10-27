import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { LISTINGS, SERVICE_FEE_RATE } from "@/lib/data";
import { uid, useRequests } from "@/lib/store";
import { useDogs } from "@/lib/dog-profiles";
import { Bath, Bed, Check, Dog, Fence, PawPrint, ShieldCheck, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListingGallery } from "@/components/ListingGallery";
import { getPublishedListing, isAvailable } from "@/lib/public-listings.functions";
import { useServerFn } from "@tanstack/react-start";
import { confirmHold, createBookingWithHold } from "@/lib/payments.functions";
import { CardHoldForm } from "@/components/CardHoldForm";
import { useSessionUser } from "@/lib/booking-requests";
import { toast } from "sonner";

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
  } : { meta: [{ title: "Introuvable — PetInn" }, { name: "robots", content: "noindex" }] },
  notFoundComponent: () => <p className="p-10 text-center">Hébergement introuvable.</p>,
  component: Detail,
});

function Detail() {
  const l = Route.useLoaderData();
  const { dogs, loading: dogsLoading, error: dogsError } = useDogs();
  const [reqs, setReqs] = useRequests();
  const [inD, setIn] = useState(""); const [outD, setOut] = useState("");
  const [sel, setSel] = useState<string[]>([]); const [msg, setMsg] = useState(""); const [sent, setSent] = useState(false);
  const nights = inD && outD ? Math.max(0, Math.round((+new Date(outD) - +new Date(inD)) / 864e5)) : 0;
  const h = l.hosted;
  const chosen = dogs.filter((d) => sel.includes(d.id));
  const dogFees = h ? nights * h.dogFee * chosen.length : 0;
  const cleaning = h && nights > 0 ? h.cleaningFee : 0;
  const subtotal = nights * l.price + dogFees + cleaning; const fee = Math.round(subtotal * SERVICE_FEE_RATE);
  const tooBig = chosen.some((d) => !l.sizes.includes(d.size));
  const tooShort = !!h && nights > 0 && nights < h.minNights;
  const unavailable = nights > 0 && !isAvailable(l, inD, outD);
  const ok = !dogsLoading && !dogsError && nights > 0 && !tooShort && !unavailable && chosen.length > 0 && chosen.length <= l.maxDogs && !tooBig;

  const user = useSessionUser();
  const [busy, setBusy] = useState(false);
  const [hold, setHold] = useState<{ bookingId: string; clientSecret: string } | null>(null);
  const createHold = useServerFn(createBookingWithHold);
  const confirm = useServerFn(confirmHold);
  const submit = async () => {
    if (h) {
      setBusy(true);
      try {
        setHold(await createHold({ data: {
          listingId: l.id, checkIn: inD, checkOut: outD, message: msg.trim(),
          dogs: chosen.map(({ id, name, breed, size, weight, behavior }) => ({ id, name, breed, size, weight: Number(weight) || 0, behavior: behavior ?? "" })),
        } }));
      } catch (e) { toast.error((e as Error).message || "La demande n’a pas pu être envoyée."); }
      setBusy(false);
      return;
    }
    setReqs([{ id: uid(), listingId: l.id, checkIn: inD, checkOut: outD, nights, dogIds: chosen.map((dog) => dog.id), dogs: chosen, message: msg, listingName: l.name, subtotal, fee, status: "en attente", createdAt: new Date().toISOString() }, ...reqs]);
    setSent(true);
  };

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
          {sent ? (
            <div className="mt-4 rounded-xl bg-accent/20 p-4 text-sm">Demande envoyée ! {l.host} va vérifier que son logement convient à votre chien. Vous ne serez débité qu'après acceptation. <Link to="/mes-demandes" className="font-semibold underline">Suivre mes demandes</Link></div>
          ) : hold ? (
            <CardHoldForm clientSecret={hold.clientSecret} total={subtotal + fee} onDone={async () => { await confirm({ data: { bookingId: hold.bookingId } }); setSent(true); }} />
          ) : (<>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <label>Arrivée<input type="date" min={h?.availableFrom} max={h?.availableTo} value={inD} onChange={(e) => setIn(e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-2 py-2" /></label>
              <label>Départ<input type="date" min={inD || h?.availableFrom} max={h?.availableTo} value={outD} onChange={(e) => setOut(e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-2 py-2" /></label>
            </div>
            <p className="mt-4 text-sm font-semibold">Chiens (passeport canin)</p>
            {dogsLoading ? <p className="mt-1 text-sm text-muted-foreground" role="status">Chargement des passeports…</p> : dogsError ? <p className="mt-1 text-sm text-destructive" role="alert">Impossible de charger vos passeports. <Link to="/passeport" className="underline">Voir mes passeports</Link></p> : dogs.length ? dogs.map((d) => (
              <label key={d.id} className="mt-1 flex items-center gap-2 text-sm"><input type="checkbox" checked={sel.includes(d.id)} onChange={() => setSel(sel.includes(d.id) ? sel.filter((x) => x !== d.id) : [...sel, d.id])} />{d.name} ({d.breed}, {d.size})</label>
            )) : <p className="mt-1 text-sm text-muted-foreground">Aucun passeport. <Link to="/passeport" className="underline">Créer un passeport canin</Link></p>}
            {tooShort && <p className="mt-2 text-sm text-destructive">Séjour minimum : {h?.minNights} nuits.</p>}
            {unavailable && <p className="mt-2 text-sm text-destructive">Le logement n’est pas disponible sur ces dates.</p>}
            {tooBig && <p className="mt-2 text-sm text-destructive">Ce gabarit n'est pas accepté ici.</p>}
            {chosen.length > l.maxDogs && <p className="mt-2 text-sm text-destructive">Maximum {l.maxDogs} chien(s).</p>}
            <textarea value={msg} onChange={(e) => setMsg(e.target.value.slice(0, 500))} placeholder="Un mot pour l'hôte (optionnel)" className="mt-3 w-full rounded-lg border bg-background px-3 py-2 text-sm" rows={3} />
            {nights > 0 && <div className="mt-3 space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between"><span>{l.price} € × {nights} nuit{nights > 1 ? "s" : ""}</span><span>{subtotal} €</span></div>
              {dogFees > 0 && <div className="flex justify-between"><span>Supplément chiens</span><span>{dogFees} €</span></div>}
              {cleaning > 0 && <div className="flex justify-between"><span>Frais de ménage</span><span>{cleaning} €</span></div>}
              <div className="flex justify-between"><span>Frais de service PetInn ({SERVICE_FEE_RATE * 100}%)</span><span>{fee} €</span></div>
              <div className="flex justify-between font-semibold"><span>Total</span><span>{subtotal + fee} €</span></div>
            </div>}
            {h && user === null ? (
              <Button asChild className="mt-4 h-12 w-full"><Link to="/auth" search={{ redirect: `/hebergement/${l.id}` }}>Se connecter pour envoyer la demande</Link></Button>
            ) : <Button disabled={!ok || busy} onClick={submit} className="mt-4 h-12 w-full bg-accent font-semibold text-accent-foreground hover:bg-accent/90">{busy ? "Envoi…" : "Envoyer la demande"}</Button>}
            <p className="mt-2 text-center text-xs text-muted-foreground">L'hôte valide manuellement votre demande.</p>
          </>)}
        </aside>
      </div>
    </div>
  );
}
