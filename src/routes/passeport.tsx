import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Size } from "@/lib/data";
import { dogProfileSchema, useDogs, type DogProfileInput } from "@/lib/dog-profiles";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PawPrint, Trash2 } from "lucide-react";

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
  const { dogs, user, loading, error, busy, addDogs, removeDog, retry } = useDogs();
  const [legacyDogs, setLegacyDogs] = useState<DogProfileInput[]>([]);
  useEffect(() => {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem("petinn-dogs") || "[]");
      if (Array.isArray(raw)) setLegacyDogs(raw.flatMap((dog) => {
        const parsed = dogProfileSchema.safeParse(dog);
        return parsed.success ? [parsed.data] : [];
      }));
    } catch { /* Invalid old storage must not block account passports. */ }
  }, []);
  const [f, setF] = useState({ name: "", breed: "", size: "moyen" as Size, weight: "", behavior: "" });
  const valid = dogProfileSchema.safeParse({ ...f, weight: Number(f.weight) }).success;
  const inp = "w-full rounded-lg border bg-background px-3 py-2";
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Passeport canin</h1>
      {loading ? <p className="mt-6" role="status">Chargement des passeports…</p> : !user ? (
        <Button asChild className="mt-6"><Link to="/auth" search={{ redirect: "/passeport" }}>Se connecter pour retrouver mes chiens</Link></Button>
      ) : <>
      {error && <div className="mt-6" role="alert"><p className="text-destructive">Impossible de charger vos passeports.</p><Button variant="outline" onClick={() => retry()}>Réessayer</Button></div>}
      {legacyDogs.length > 0 && <div className="mt-6 border-b pb-5"><p className="text-sm text-muted-foreground">{legacyDogs.length} passeport(s) enregistré(s) sur cet appareil.</p><Button variant="outline" className="mt-2" disabled={busy} onClick={async () => {
        try { await addDogs(legacyDogs); localStorage.removeItem("petinn-dogs"); setLegacyDogs([]); toast.success("Passeports rattachés à votre compte."); }
        catch { toast.error("Les passeports n’ont pas pu être importés."); }
      }}>Rattacher ces chiens à mon compte</Button></div>}
      <form onSubmit={async (e) => { e.preventDefault(); if (!valid || busy) return;
        try { await addDogs([{ ...f, weight: Number(f.weight) }]); setF({ name: "", breed: "", size: "moyen", weight: "", behavior: "" }); toast.success("Passeport enregistré."); }
        catch { toast.error("Le passeport n’a pas pu être enregistré. Réessayez."); }
      }} className="mt-6 grid gap-3 border-b pb-6 sm:grid-cols-2">
        <input className={inp} aria-label="Nom" maxLength={50} placeholder="Nom" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className={inp} aria-label="Race" maxLength={60} placeholder="Race" value={f.breed} onChange={(e) => setF({ ...f, breed: e.target.value })} />
        <select className={inp} aria-label="Gabarit" value={f.size} onChange={(e) => setF({ ...f, size: e.target.value as Size })}>
          <option value="petit">Petit (&lt; 10 kg)</option><option value="moyen">Moyen (10–25 kg)</option><option value="grand">Grand (&gt; 25 kg)</option>
        </select>
        <input className={inp} aria-label="Poids (kg)" type="number" step="any" placeholder="Poids (kg)" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} />
        <textarea className={`${inp} sm:col-span-2`} aria-label="Comportement" maxLength={500} rows={3} placeholder="Comportement (sociable, aboie, propre, peur des chats…)" value={f.behavior} onChange={(e) => setF({ ...f, behavior: e.target.value })} />
        <Button type="submit" disabled={!valid || busy || !!error} className="h-12 sm:col-span-2">{busy ? "Enregistrement…" : "Ajouter ce chien"}</Button>
      </form>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {dogs.map((d) => (
          <div key={d.id} className="rounded-lg border bg-card p-5">
            <div className="flex items-start justify-between gap-3"><h3 className="flex min-w-0 items-center gap-2 break-words font-display text-xl font-semibold"><PawPrint className="size-5 shrink-0 text-primary" />{d.name}</h3>
              <Button variant="ghost" size="icon" disabled={busy} title="Supprimer ce passeport" aria-label={`Supprimer ${d.name}`} onClick={async () => {
                if (!window.confirm(`Supprimer le passeport de ${d.name} ?`)) return;
                try { await removeDog(d.id); toast.success("Passeport supprimé."); } catch { toast.error("Le passeport n’a pas pu être supprimé."); }
              }}><Trash2 className="text-destructive" /></Button></div>
            <p className="text-sm text-muted-foreground">{d.breed} · {d.size} · {d.weight} kg</p>
            {d.behavior && <p className="mt-2 text-sm">{d.behavior}</p>}
          </div>
        ))}
      </div>
      </>}
    </div>
  );
}
