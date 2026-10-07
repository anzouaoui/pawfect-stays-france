import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LISTINGS, TYPES } from "@/lib/data";
import { ListingCard } from "@/components/ListingCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PetInn — Hébergements 100% pet-friendly en France" },
      { name: "description", content: "Hôtels, campings, villas et villages vacances qui accueillent vraiment votre chien. Réservez sur PetInn." },
      { property: "og:title", content: "PetInn — Voyagez avec votre chien en France" },
      { property: "og:description", content: "Trouvez et réservez des hébergements 100% pet-friendly en France." },
    ],
  }),
  component: Home,
});

function Home() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  return (
    <div>
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <p className="text-sm uppercase tracking-widest opacity-80">Vacances à quatre pattes</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-tight md:text-6xl">Des séjours où votre chien est le bienvenu, vraiment.</h1>
          <p className="mt-4 max-w-xl opacity-90">Hôtels, campings, villas et villages vacances 100% pet-friendly partout en France.</p>
          <form onSubmit={(e) => { e.preventDefault(); nav({ to: "/recherche", search: { q, type, from, to } }); }}
            className="mt-8 flex flex-col gap-2 rounded-2xl bg-card p-2 text-foreground shadow-xl md:flex-row">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Où allez-vous ? (ville, région)" className="flex-1 rounded-xl px-4 py-3 outline-none" />
            <input type="date" aria-label="Arrivée" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl bg-secondary px-3 py-3" />
            <input type="date" aria-label="Départ" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl bg-secondary px-3 py-3" />
            <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl bg-secondary px-4 py-3">
              <option value="">Tous types</option>{TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <button className="rounded-xl bg-accent px-6 py-3 font-semibold text-accent-foreground">Rechercher</button>
          </form>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-3">
        {[["🐾", "100% pet-friendly", "Chaque hébergement est vérifié pour accueillir les chiens."],
          ["✅", "Validation par l'hôte", "L'hébergeur confirme que son logement convient à votre chien."],
          ["📘", "Passeport canin", "Remplissez-le une fois, joignez-le à chaque demande."]].map(([i, t, d]) => (
          <div key={t} className="rounded-2xl border bg-card p-6"><div className="text-3xl">{i}</div><h3 className="mt-3 font-display text-xl font-semibold">{t}</h3><p className="mt-1 text-sm text-muted-foreground">{d}</p></div>
        ))}
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="font-display text-3xl font-bold">Coups de cœur</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{LISTINGS.map((l) => <ListingCard key={l.id} l={l} />)}</div>
      </section>
    </div>
  );
}
