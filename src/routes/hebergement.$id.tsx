import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { LISTINGS, SERVICE_FEE_RATE } from "@/lib/data";
import { uid, useDogs, useRequests } from "@/lib/store";

export const Route = createFileRoute("/hebergement/$id")({
  loader: ({ params }) => {
    const l = LISTINGS.find((x) => x.id === params.id);
    if (!l) throw notFound();
    return l;
  },
  head: ({ loaderData: l }) => l ? {
    meta: [
      { title: `${l.name} à ${l.city} — PetInn` },
      { name: "description", content: l.description },
      { property: "og:title", content: `${l.name} — ${l.type} pet-friendly` },
      { property: "og:description", content: l.description },
      { property: "og:image", content: l.image },
      { name: "twitter:image", content: l.image },
    ],
  } : { meta: [{ title: "Introuvable — PetInn" }, { name: "robots", content: "noindex" }] },
  notFoundComponent: () => <p className="p-10 text-center">Hébergement introuvable.</p>,
  component: Detail,
});

function Detail() {
  const l = Route.useLoaderData();
  const [dogs] = useDogs();
  const [reqs, setReqs] = useRequests();
  const [inD, setIn] = useState(""); const [outD, setOut] = useState("");
  const [sel, setSel] = useState<string[]>([]); const [msg, setMsg] = useState(""); const [sent, setSent] = useState(false);
  const nights = inD && outD ? Math.max(0, Math.round((+new Date(outD) - +new Date(inD)) / 864e5)) : 0;
  const subtotal = nights * l.price; const fee = Math.round(subtotal * SERVICE_FEE_RATE);
  const chosen = dogs.filter((d) => sel.includes(d.id));
  const tooBig = chosen.some((d) => !l.sizes.includes(d.size));
  const ok = nights > 0 && chosen.length > 0 && chosen.length <= l.maxDogs && !tooBig;

  const submit = () => {
    setReqs([{ id: uid(), listingId: l.id, checkIn: inD, checkOut: outD, nights, dogIds: sel, dogs: chosen, message: msg, subtotal, fee, status: "en attente", createdAt: new Date().toISOString() }, ...reqs]);
    setSent(true);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <img src={l.image} alt={l.name} className="aspect-[21/9] w-full rounded-3xl object-cover" />
      <div className="mt-8 grid gap-10 md:grid-cols-[1fr_380px]">
        <div>
          <p className="text-sm text-muted-foreground">{l.type} · {l.city}, {l.region} · ★ {l.rating}</p>
          <h1 className="mt-1 font-display text-4xl font-bold">{l.name}</h1>
          <p className="mt-4 text-lg">{l.description}</p>
          <h2 className="mt-8 font-display text-xl font-semibold">Accueil des chiens</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            <li className="rounded-xl border bg-card p-3">{l.fencedGarden ? "✅ Jardin clôturé" : "— Pas de jardin clôturé"}</li>
            <li className="rounded-xl border bg-card p-3">🐕 Gabarits : {l.sizes.join(", ")}</li>
            <li className="rounded-xl border bg-card p-3">🔢 Jusqu'à {l.maxDogs} chien{l.maxDogs > 1 ? "s" : ""}</li>
            <li className="rounded-xl border bg-card p-3">👤 Hôte : {l.host}</li>
          </ul>
          <h2 className="mt-8 font-display text-xl font-semibold">Équipements fournis</h2>
          <div className="mt-3 flex flex-wrap gap-2">{l.equipment.map((e) => <span key={e} className="rounded-full bg-secondary px-3 py-1 text-sm">{e}</span>)}</div>
        </div>
        <aside className="h-fit rounded-2xl border bg-card p-5 shadow-sm md:sticky md:top-20">
          <p><span className="text-2xl font-bold">{l.price} €</span> / nuit</p>
          {sent ? (
            <div className="mt-4 rounded-xl bg-accent/20 p-4 text-sm">Demande envoyée ! {l.host} va vérifier que son logement convient à votre chien. Vous ne serez débité qu'après acceptation. <Link to="/mes-demandes" className="font-semibold underline">Suivre mes demandes</Link></div>
          ) : (<>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <label>Arrivée<input type="date" value={inD} onChange={(e) => setIn(e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-2 py-2" /></label>
              <label>Départ<input type="date" value={outD} onChange={(e) => setOut(e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-2 py-2" /></label>
            </div>
            <p className="mt-4 text-sm font-semibold">Chiens (passeport canin)</p>
            {dogs.length ? dogs.map((d) => (
              <label key={d.id} className="mt-1 flex items-center gap-2 text-sm"><input type="checkbox" checked={sel.includes(d.id)} onChange={() => setSel(sel.includes(d.id) ? sel.filter((x) => x !== d.id) : [...sel, d.id])} />{d.name} ({d.breed}, {d.size})</label>
            )) : <p className="mt-1 text-sm text-muted-foreground">Aucun passeport. <Link to="/passeport" className="underline">Créer un passeport canin</Link></p>}
            {tooBig && <p className="mt-2 text-sm text-destructive">Ce gabarit n'est pas accepté ici.</p>}
            {chosen.length > l.maxDogs && <p className="mt-2 text-sm text-destructive">Maximum {l.maxDogs} chien(s).</p>}
            <textarea value={msg} onChange={(e) => setMsg(e.target.value.slice(0, 500))} placeholder="Un mot pour l'hôte (optionnel)" className="mt-3 w-full rounded-lg border bg-background px-3 py-2 text-sm" rows={3} />
            {nights > 0 && <div className="mt-3 space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between"><span>{l.price} € × {nights} nuit{nights > 1 ? "s" : ""}</span><span>{subtotal} €</span></div>
              <div className="flex justify-between"><span>Frais de service PetInn ({SERVICE_FEE_RATE * 100}%)</span><span>{fee} €</span></div>
              <div className="flex justify-between font-semibold"><span>Total</span><span>{subtotal + fee} €</span></div>
            </div>}
            <button disabled={!ok} onClick={submit} className="mt-4 w-full rounded-xl bg-accent py-3 font-semibold text-accent-foreground disabled:opacity-40">Envoyer la demande</button>
            <p className="mt-2 text-center text-xs text-muted-foreground">L'hôte valide manuellement votre demande.</p>
          </>)}
        </aside>
      </div>
    </div>
  );
}
