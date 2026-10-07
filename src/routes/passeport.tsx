import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type { Size } from "@/lib/data";
import { uid, useDogs } from "@/lib/store";

export const Route = createFileRoute("/passeport")({
  head: () => ({
    meta: [
      { title: "Passeport canin — PetInn" },
      { name: "description", content: "Enregistrez nom, race, taille, poids et comportement de votre chien pour simplifier vos réservations." },
      { property: "og:title", content: "Mon passeport canin — PetInn" },
      { property: "og:description", content: "Les infos essentielles de votre chien, jointes à chaque demande." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Passport,
});

function Passport() {
  const [dogs, setDogs] = useDogs();
  const [f, setF] = useState({ name: "", breed: "", size: "moyen" as Size, weight: "", behavior: "" });
  const valid = f.name.trim() && f.breed.trim() && +f.weight > 0 && +f.weight < 120;
  const inp = "w-full rounded-lg border bg-background px-3 py-2";
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Passeport canin</h1>
      <p className="mt-1 text-muted-foreground">Remplissez-le une fois : il est joint automatiquement à vos demandes.</p>
      <form onSubmit={(e) => { e.preventDefault(); if (!valid) return; setDogs([...dogs, { id: uid(), name: f.name.trim().slice(0, 50), breed: f.breed.trim().slice(0, 60), size: f.size, weight: +f.weight, behavior: f.behavior.slice(0, 500) }]); setF({ name: "", breed: "", size: "moyen", weight: "", behavior: "" }); }}
        className="mt-6 grid gap-3 rounded-2xl border bg-card p-5 sm:grid-cols-2">
        <input className={inp} placeholder="Nom" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className={inp} placeholder="Race" value={f.breed} onChange={(e) => setF({ ...f, breed: e.target.value })} />
        <select className={inp} value={f.size} onChange={(e) => setF({ ...f, size: e.target.value as Size })}>
          <option value="petit">Petit (&lt; 10 kg)</option><option value="moyen">Moyen (10–25 kg)</option><option value="grand">Grand (&gt; 25 kg)</option>
        </select>
        <input className={inp} type="number" placeholder="Poids (kg)" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} />
        <textarea className={`${inp} sm:col-span-2`} rows={3} placeholder="Comportement (sociable, aboie, propre, peur des chats…)" value={f.behavior} onChange={(e) => setF({ ...f, behavior: e.target.value })} />
        <button disabled={!valid} className="rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-40 sm:col-span-2">Ajouter ce chien</button>
      </form>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {dogs.map((d) => (
          <div key={d.id} className="rounded-2xl border bg-card p-5">
            <div className="flex justify-between"><h3 className="font-display text-xl font-semibold">🐶 {d.name}</h3>
              <button onClick={() => setDogs(dogs.filter((x) => x.id !== d.id))} className="text-sm text-destructive">Supprimer</button></div>
            <p className="text-sm text-muted-foreground">{d.breed} · {d.size} · {d.weight} kg</p>
            {d.behavior && <p className="mt-2 text-sm">{d.behavior}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
