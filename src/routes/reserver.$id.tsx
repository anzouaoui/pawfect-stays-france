import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { LISTINGS, SERVICE_FEE_RATE } from "@/lib/data";
import { uid, useRequests } from "@/lib/store";
import { useDogs } from "@/lib/dog-profiles";
import { Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublishedListing, isAvailable } from "@/lib/public-listings.functions";
import { useServerFn } from "@tanstack/react-start";
import { confirmHold, createBookingWithHold } from "@/lib/payments.functions";
import { CardHoldForm } from "@/components/CardHoldForm";
import { useSessionUser } from "@/lib/booking-requests";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, max as maxDate } from "date-fns";
import { fr } from "date-fns/locale";

export const Route = createFileRoute("/reserver/$id")({
  loader: async ({ params }) => {
    const l = LISTINGS.find((x) => x.id === params.id)
      ?? (/^[0-9a-f-]{36}$/i.test(params.id) ? await getPublishedListing({ data: { id: params.id } }) : null);
    if (!l) throw notFound();
    return l;
  },
  head: ({ loaderData: l }) => {
    const title = l ? `Réserver ${l.name} — PetInn` : "Réservation indisponible — PetInn";
    const description = l ? `Demande de réservation et paiement sécurisé pour ${l.name} à ${l.city}.` : "Cette réservation PetInn n’est pas disponible.";
    return { meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ] };
  },
  errorComponent: () => <p className="p-10 text-center">Impossible de charger la réservation.</p>,
  notFoundComponent: () => <p className="p-10 text-center">Hébergement introuvable.</p>,
  component: Booking,
});

function Booking() {
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
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/hebergement/$id" params={{ id: l.id }} className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">← Retour au logement</Link>
      <h1 className="font-display text-3xl font-bold">Réserver votre séjour</h1>
      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_340px]">
        <section className="rounded-2xl border bg-card p-5">
          {sent ? (
            <div className="rounded-xl bg-accent/20 p-4 text-sm">Demande envoyée ! {l.host} va vérifier que son logement convient à votre chien. Vous ne serez débité qu'après acceptation. <Link to="/mes-demandes" className="font-semibold underline">Suivre mes demandes</Link></div>
          ) : hold ? (<>
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Lock className="size-5 text-primary" />Paiement sécurisé</h2>
            <CardHoldForm clientSecret={hold.clientSecret} total={subtotal + fee} onDone={async () => { await confirm({ data: { bookingId: hold.bookingId } }); setSent(true); }} />
          </>) : (<>
            <h2 className="font-display text-xl font-semibold">1. Vos dates</h2>
            <Calendar
              mode="range" locale={fr} weekStartsOn={1} numberOfMonths={1}
              defaultMonth={inD ? parseISO(inD) : h ? maxDate([new Date(), parseISO(h.availableFrom)]) : new Date()}
              selected={{ from: inD ? parseISO(inD) : undefined, to: outD ? parseISO(outD) : undefined }}
              onSelect={(r) => { setIn(r?.from ? format(r.from, "yyyy-MM-dd") : ""); setOut(r?.to && r.from && +r.to !== +r.from ? format(r.to, "yyyy-MM-dd") : ""); }}
              disabled={(d) => {
                const s = format(d, "yyyy-MM-dd");
                if (s < format(new Date(), "yyyy-MM-dd")) return true;
                if (!h) return false;
                return s < h.availableFrom || s > h.availableTo || h.blockedDates.includes(s);
              }}
              className="pointer-events-auto mt-2 w-fit rounded-lg border p-3"
            />
            <p className="mt-2 text-sm text-muted-foreground">
              {inD && outD ? `Du ${format(parseISO(inD), "d MMM", { locale: fr })} au ${format(parseISO(outD), "d MMM yyyy", { locale: fr })} · ${nights} nuit${nights > 1 ? "s" : ""}` : inD ? "Choisissez la date de départ." : "Choisissez la date d’arrivée."}
              {(inD || outD) && <button type="button" onClick={() => { setIn(""); setOut(""); }} className="ml-2 underline">Effacer</button>}
            </p>
            <h2 className="mt-6 font-display text-xl font-semibold">2. Vos chiens</h2>
            {dogsLoading ? <p className="mt-1 text-sm text-muted-foreground" role="status">Chargement des passeports…</p> : dogsError ? <p className="mt-1 text-sm text-destructive" role="alert">Impossible de charger vos passeports. <Link to="/passeport" className="underline">Voir mes passeports</Link></p> : dogs.length ? dogs.map((d) => (
              <label key={d.id} className="mt-1 flex items-center gap-2 text-sm"><input type="checkbox" checked={sel.includes(d.id)} onChange={() => setSel(sel.includes(d.id) ? sel.filter((x) => x !== d.id) : [...sel, d.id])} />{d.name} ({d.breed}, {d.size})</label>
            )) : <p className="mt-1 text-sm text-muted-foreground">Aucun passeport. <Link to="/passeport" className="underline">Créer un passeport canin</Link></p>}
            {tooShort && <p className="mt-2 text-sm text-destructive">Séjour minimum : {h?.minNights} nuits.</p>}
            {unavailable && <p className="mt-2 text-sm text-destructive">Le logement n’est pas disponible sur ces dates.</p>}
            {tooBig && <p className="mt-2 text-sm text-destructive">Ce gabarit n'est pas accepté ici.</p>}
            {chosen.length > l.maxDogs && <p className="mt-2 text-sm text-destructive">Maximum {l.maxDogs} chien(s).</p>}
            <h2 className="mt-6 font-display text-xl font-semibold">3. Un mot pour l’hôte</h2>
            <textarea value={msg} onChange={(e) => setMsg(e.target.value.slice(0, 500))} placeholder="Optionnel" className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm" rows={3} />
            {h && user === null ? (
              <Button asChild className="mt-4 h-12 w-full"><Link to="/auth" search={{ redirect: `/reserver/${l.id}` }}>Se connecter pour réserver</Link></Button>
            ) : <Button disabled={!ok || busy} onClick={submit} className="mt-4 h-12 w-full bg-accent font-semibold text-accent-foreground hover:bg-accent/90">{busy ? "Envoi…" : "Continuer vers le paiement sécurisé"}</Button>}
          </>)}
        </section>
        <aside className="h-fit rounded-2xl border bg-card p-5 md:sticky md:top-20">
          <img src={l.image} alt={l.name} className="aspect-[4/3] w-full rounded-xl object-cover" />
          <p className="mt-3 text-sm text-muted-foreground">{l.type} · {l.city}</p>
          <p className="font-display text-lg font-semibold">{l.name}</p>
          <div className="mt-3 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between"><span>{l.price} € × {nights} nuit{nights > 1 ? "s" : ""}</span><span>{nights * l.price} €</span></div>
            {dogFees > 0 && <div className="flex justify-between"><span>Supplément chiens</span><span>{dogFees} €</span></div>}
            {cleaning > 0 && <div className="flex justify-between"><span>Frais de ménage</span><span>{cleaning} €</span></div>}
            <div className="flex justify-between"><span>Frais de service PetInn ({SERVICE_FEE_RATE * 100}%)</span><span>{fee} €</span></div>
            <div className="flex justify-between font-semibold"><span>Total</span><span>{subtotal + fee} €</span></div>
          </div>
          <p className="mt-3 flex gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 shrink-0 text-primary" />Paiement chiffré par Stripe. Montant bloqué, débité uniquement si l’hôte accepte sous 24 h.</p>
        </aside>
      </div>
    </div>
  );
}
