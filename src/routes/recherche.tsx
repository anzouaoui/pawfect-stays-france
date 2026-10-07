import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { EQUIPMENT, LISTINGS, TYPES, type Size } from "@/lib/data";
import { ListingCard } from "@/components/ListingCard";

export const Route = createFileRoute("/recherche")({
  validateSearch: (s: Record<string, unknown>) => ({ q: (s.q as string) ?? "", type: (s.type as string) ?? "", from: (s.from as string) ?? "", to: (s.to as string) ?? "" }),
  head: () => ({
    meta: [
      { title: "Rechercher un hébergement pet-friendly — PetInn" },
      { name: "description", content: "Filtrez par jardin clôturé, gabarit accepté et équipements fournis pour votre chien." },
      { property: "og:title", content: "Recherche d'hébergements pet-friendly — PetInn" },
      { property: "og:description", content: "Filtres pensés pour les chiens : jardin clôturé, taille, équipements." },
    ],
  }),
  component: Search,
});

function Search() {
  const s = Route.useSearch();
  const [q, setQ] = useState(s.q);
  const [type, setType] = useState(s.type);
  const [from, setFrom] = useState(s.from); const [to, setTo] = useState(s.to);
  const [fenced, setFenced] = useState(false);
  const [size, setSize] = useState<Size | "">("");
  const [eq, setEq] = useState<string[]>([]);
  const [max, setMax] = useState(300);

  const res = LISTINGS.filter((l) =>
    (!q || `${l.city} ${l.region} ${l.name}`.toLowerCase().includes(q.toLowerCase())) &&
    (!type || l.type === type) && (!fenced || l.fencedGarden) && (!size || l.sizes.includes(size)) &&
    eq.every((e) => l.equipment.includes(e)) && l.price <= max);

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[260px_1fr]">
      <aside className="space-y-5 rounded-2xl border bg-card p-5 text-sm md:sticky md:top-20 md:self-start">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ville, région…" className="w-full rounded-lg border bg-background px-3 py-2" />
        <div className="grid grid-cols-2 gap-2"><input type="date" aria-label="Arrivée" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border bg-background px-2 py-2" /><input type="date" aria-label="Départ" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border bg-background px-2 py-2" /></div>
        <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2">
          <option value="">Tous types</option>{TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <label className="flex items-center gap-2"><input type="checkbox" checked={fenced} onChange={(e) => setFenced(e.target.checked)} /> Jardin clôturé</label>
        <div><p className="mb-2 font-semibold">Gabarit de votre chien</p>
          <div className="flex gap-1">{(["", "petit", "moyen", "grand"] as const).map((z) => (
            <button key={z} onClick={() => setSize(z)} className={`flex-1 rounded-lg border px-2 py-1 ${size === z ? "bg-primary text-primary-foreground" : ""}`}>{z || "Tous"}</button>))}</div>
        </div>
        <div><p className="mb-2 font-semibold">Équipements fournis</p>
          {EQUIPMENT.map((e) => <label key={e} className="flex items-center gap-2 py-0.5"><input type="checkbox" checked={eq.includes(e)} onChange={() => setEq(eq.includes(e) ? eq.filter((x) => x !== e) : [...eq, e])} /> {e}</label>)}
        </div>
        <div><p className="mb-2 font-semibold">Prix max : {max} € / nuit</p><input type="range" min={40} max={300} value={max} onChange={(e) => setMax(+e.target.value)} className="w-full" /></div>
      </aside>
      <div>
        <h1 className="font-display text-2xl font-bold">{res.length} hébergement{res.length > 1 ? "s" : ""} pet-friendly</h1>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">{res.map((l) => <ListingCard key={l.id} l={l} />)}</div>
        {!res.length && <p className="mt-6 text-muted-foreground">Aucun résultat, essayez d'élargir vos filtres.</p>}
      </div>
    </div>
  );
}
