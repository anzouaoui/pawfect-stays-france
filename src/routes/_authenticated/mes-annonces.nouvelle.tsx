import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EQUIPMENT, TYPES, type Size } from "@/lib/data";
import { listingSchema, MAX_PHOTOS, PHOTO_BUCKET } from "@/lib/host-listings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/mes-annonces/nouvelle")({
  head: () => ({
    meta: [
      { title: "Ajouter un logement — PetInn" },
      { name: "description", content: "Publiez un logement pet-friendly : photos, tarifs, disponibilités et règles canines." },
      { property: "og:title", content: "Ajouter un logement — PetInn" },
      { property: "og:description", content: "Publiez votre logement pet-friendly sur PetInn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewListing,
});

const SIZES: Size[] = ["petit", "moyen", "grand"];
const DEFAULT_RULES = [
  { title: "En laisse dans les parties communes", description: "Votre chien doit être tenu en laisse en dehors du logement et du jardin." },
  { title: "Absences", description: "Ne laissez pas votre chien seul dans le logement sans accord préalable." },
];

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function NewListing() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: "", type: "", city: "", region: "", description: "", price: "", dogFee: "0", cleaning: "0", minNights: "1", from: "", to: "", maxDogs: "1", fenced: false });
  const [sizes, setSizes] = useState<Size[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [blockInput, setBlockInput] = useState("");
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const valid = Array.from(list).filter((file) => {
      if (!file.type.startsWith("image/")) { toast.error(`${file.name} n'est pas une image.`); return false; }
      if (file.size > 8 * 1024 * 1024) { toast.error(`${file.name} dépasse 8 Mo.`); return false; }
      return true;
    });
    setFiles((cur) => [...cur, ...valid].slice(0, MAX_PHOTOS));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = listingSchema.safeParse({
      name: f.name, type: f.type, city: f.city, region: f.region, description: f.description,
      price_per_night: f.price === "" ? NaN : Number(f.price), dog_fee_per_night: Number(f.dogFee || 0), cleaning_fee: Number(f.cleaning || 0),
      min_nights: Number(f.minNights || 1), available_from: f.from, available_to: f.to, blocked_dates: blocked,
      fenced_garden: f.fenced, sizes, max_dogs: Number(f.maxDogs || 1), equipment, dog_rules: rules,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Formulaire incomplet");
    if (files.length < 3) return toast.error("Ajoutez au moins 3 photos.");
    setBusy(true);
    const paths: string[] = [];
    try {
      for (const file of files) {
        const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { contentType: file.type });
        if (error) throw error;
        paths.push(path);
      }
      const { error } = await supabase.from("host_listings").insert({ ...parsed.data, owner_id: user.id, photos: paths, status: "publiée" });
      if (error) throw error;
      toast.success("Logement publié !");
      navigate({ to: "/mes-annonces" });
    } catch (err) {
      console.error(err);
      if (paths.length) await supabase.storage.from(PHOTO_BUCKET).remove(paths);
      toast.error("L'enregistrement a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div>
        <h1 className="font-display text-3xl font-bold">Ajouter un logement</h1>
        <p className="mt-1 text-muted-foreground">Décrivez votre logement, vos tarifs, vos disponibilités et vos règles pour les chiens.</p>
      </div>

      <Section title="Le logement">
        <div className="space-y-1.5"><Label htmlFor="name">Nom de l'annonce</Label><Input id="name" value={f.name} onChange={set("name")} maxLength={120} placeholder="Ex. Gîte du Moulin" /></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5"><Label htmlFor="type">Type</Label>
            <select id="type" value={f.type} onChange={set("type")} className="h-9 w-full rounded-md border bg-background px-3 text-sm"><option value="">Choisir…</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div className="space-y-1.5"><Label htmlFor="city">Ville</Label><Input id="city" value={f.city} onChange={set("city")} maxLength={80} /></div>
          <div className="space-y-1.5"><Label htmlFor="region">Région</Label><Input id="region" value={f.region} onChange={set("region")} maxLength={80} /></div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="desc">Description</Label><Textarea id="desc" rows={4} value={f.description} onChange={set("description")} maxLength={2000} /></div>
      </Section>

      <Section title="Photos" hint={`Entre 3 et ${MAX_PHOTOS} photos réelles de votre logement. La première sera la photo principale.`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {previews.map((src, i) => (
            <div key={src} className="relative aspect-[4/3] overflow-hidden rounded-xl border">
              <img src={src} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-semibold">Principale</span>}
              <Button type="button" size="icon" variant="secondary" className="absolute right-1 top-1 h-7 w-7" aria-label={`Retirer la photo ${i + 1}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}><X /></Button>
            </div>
          ))}
          {files.length < MAX_PHOTOS && (
            <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-sm text-muted-foreground hover:bg-muted">
              <ImagePlus className="h-6 w-6" />Ajouter
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </label>
          )}
        </div>
      </Section>

      <Section title="Tarifs" hint="La commission de service PetInn est payée par le voyageur, elle ne s'ajoute pas à vos tarifs.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="price">Prix par nuit (€)</Label><Input id="price" type="number" min={1} step="1" value={f.price} onChange={set("price")} /></div>
          <div className="space-y-1.5"><Label htmlFor="dogfee">Supplément par chien et par nuit (€)</Label><Input id="dogfee" type="number" min={0} step="1" value={f.dogFee} onChange={set("dogFee")} /></div>
          <div className="space-y-1.5"><Label htmlFor="cleaning">Frais de ménage (€)</Label><Input id="cleaning" type="number" min={0} step="1" value={f.cleaning} onChange={set("cleaning")} /></div>
          <div className="space-y-1.5"><Label htmlFor="min">Séjour minimum (nuits)</Label><Input id="min" type="number" min={1} max={60} value={f.minNights} onChange={set("minNights")} /></div>
        </div>
      </Section>

      <Section title="Disponibilités" hint="Indiquez la période d'ouverture et les dates où le logement n'est pas disponible.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="from">Ouvert à partir du</Label><Input id="from" type="date" value={f.from} onChange={set("from")} /></div>
          <div className="space-y-1.5"><Label htmlFor="to">Jusqu'au</Label><Input id="to" type="date" min={f.from} value={f.to} onChange={set("to")} /></div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="block">Dates indisponibles</Label>
          <div className="flex gap-2">
            <Input id="block" type="date" min={f.from} max={f.to} value={blockInput} onChange={(e) => setBlockInput(e.target.value)} />
            <Button type="button" variant="outline" onClick={() => { if (blockInput && !blocked.includes(blockInput)) setBlocked([...blocked, blockInput].sort()); setBlockInput(""); }}>Bloquer</Button>
          </div>
          <div className="flex flex-wrap gap-2">{blocked.map((d) => (
            <button type="button" key={d} onClick={() => setBlocked(blocked.filter((x) => x !== d))} className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs">{new Date(d).toLocaleDateString("fr-FR")}<X className="h-3 w-3" /></button>))}</div>
        </div>
      </Section>

      <Section title="Accueil des chiens">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="maxdogs">Nombre de chiens maximum</Label><Input id="maxdogs" type="number" min={1} max={10} value={f.maxDogs} onChange={set("maxDogs")} /></div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><Checkbox checked={f.fenced} onCheckedChange={(v) => setF({ ...f, fenced: v === true })} />Jardin entièrement clôturé</label>
        </div>
        <div><p className="mb-2 text-sm font-medium">Gabarits acceptés</p>
          <div className="flex flex-wrap gap-2">{SIZES.map((s) => (
            <button type="button" key={s} onClick={() => setSizes(toggleIn(sizes, s))} className={`rounded-full border px-4 py-1.5 text-sm capitalize ${sizes.includes(s) ? "bg-primary text-primary-foreground" : ""}`}>{s}</button>))}</div></div>
        <div><p className="mb-2 text-sm font-medium">Équipements fournis</p>
          <div className="grid gap-2 sm:grid-cols-2">{EQUIPMENT.map((e) => (
            <label key={e} className="flex items-center gap-2 text-sm"><Checkbox checked={equipment.includes(e)} onCheckedChange={() => setEquipment(toggleIn(equipment, e))} />{e}</label>))}</div></div>
      </Section>

      <Section title="Règles canines" hint="Expliquez clairement ce qui est permis ou non pour les chiens.">
        {rules.map((r, i) => (
          <div key={i} className="space-y-2 rounded-xl border p-3">
            <div className="flex gap-2">
              <Input aria-label={`Titre de la règle ${i + 1}`} value={r.title} maxLength={80} placeholder="Titre" onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
              <Button type="button" variant="ghost" size="icon" aria-label={`Supprimer la règle ${i + 1}`} onClick={() => setRules(rules.filter((_, j) => j !== i))}><Trash2 /></Button>
            </div>
            <Textarea aria-label={`Description de la règle ${i + 1}`} rows={2} value={r.description} maxLength={500} placeholder="Détail de la règle" onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => setRules([...rules, { title: "", description: "" }])}><Plus />Ajouter une règle</Button>
      </Section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => navigate({ to: "/mes-annonces" })}>Annuler</Button>
        <Button type="submit" disabled={busy}>{busy ? "Publication…" : "Publier le logement"}</Button>
      </div>
    </form>
  );
}
