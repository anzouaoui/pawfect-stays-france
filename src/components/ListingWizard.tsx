import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EQUIPMENT, TYPES, type Size } from "@/lib/data";
import { listingSchema, MAX_PHOTOS, PHOTO_BUCKET, photoUrls } from "@/lib/host-listings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const SIZES: Size[] = ["petit", "moyen", "grand"];
const STEPS = ["Logement", "Photos", "Tarifs", "Disponibilités", "Chiens", "Règles"] as const;
const DEFAULT_RULES = [
  { title: "En laisse dans les parties communes", description: "Votre chien doit être tenu en laisse en dehors du logement et du jardin." },
  { title: "Absences", description: "Ne laissez pas votre chien seul dans le logement sans accord préalable." },
];
const today = () => new Date().toISOString().slice(0, 10);

type Form = { name: string; type: string; city: string; region: string; description: string; price: string; dogFee: string; cleaning: string; minNights: string; from: string; to: string; maxDogs: string; fenced: boolean };
type Photo = { path: string; url: string };
type SaveState = "idle" | "saving" | "saved" | "error";

const EMPTY: Form = { name: "", type: "", city: "", region: "", description: "", price: "", dogFee: "0", cleaning: "0", minNights: "1", from: "", to: "", maxDogs: "1", fenced: false };

export function ListingWizard({ userId, draftId }: { userId: string; draftId?: string | undefined }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [id, setId] = useState<string | undefined>(draftId);
  const [loaded, setLoaded] = useState(!draftId);
  const [f, setF] = useState<Form>(EMPTY);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [blockInput, setBlockInput] = useState("");
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [save, setSave] = useState<SaveState>("idle");
  const [publishing, setPublishing] = useState(false);
  const dirty = useRef(false);
  const saving = useRef<Promise<string | undefined> | null>(null);

  // Resume an existing draft
  useEffect(() => {
    if (!draftId) return;
    (async () => {
      const { data, error } = await supabase.from("host_listings").select("*").eq("id", draftId).eq("owner_id", userId).maybeSingle();
      if (error || !data) { toast.error("Brouillon introuvable."); navigate({ to: "/mes-annonces" }); return; }
      setF({ name: data.name, type: data.type, city: data.city, region: data.region, description: data.description,
        price: Number(data.price_per_night) ? String(data.price_per_night) : "", dogFee: String(data.dog_fee_per_night), cleaning: String(data.cleaning_fee),
        minNights: String(data.min_nights), from: data.available_from, to: data.available_to, maxDogs: String(data.max_dogs), fenced: data.fenced_garden });
      setSizes(data.sizes as Size[]); setEquipment(data.equipment); setBlocked(data.blocked_dates);
      const r = Array.isArray(data.dog_rules) ? (data.dog_rules as { title: string; description: string }[]) : [];
      setRules(r.length ? r : DEFAULT_RULES);
      const urls = await photoUrls(data.photos);
      setPhotos(data.photos.map((path, i) => ({ path, url: urls[i] ?? "" })));
      setLoaded(true);
    })();
  }, [draftId, userId, navigate]);

  const payload = useCallback(() => ({
    name: f.name.trim(), type: f.type, city: f.city.trim(), region: f.region.trim(), description: f.description.trim(),
    price_per_night: Number(f.price) || 0, dog_fee_per_night: Number(f.dogFee) || 0, cleaning_fee: Number(f.cleaning) || 0,
    min_nights: Math.max(1, Number(f.minNights) || 1), available_from: f.from || today(), available_to: f.to || f.from || today(),
    blocked_dates: blocked, fenced_garden: f.fenced, sizes, max_dogs: Math.max(1, Number(f.maxDogs) || 1), equipment,
    dog_rules: rules, photos: photos.map((p) => p.path),
  }), [f, blocked, sizes, equipment, rules, photos]);

  const saveDraft = useCallback(async (): Promise<string | undefined> => {
    if (saving.current) await saving.current;
    if (!dirty.current && id) return id;
    dirty.current = false;
    setSave("saving");
    const run = (async () => {
      const data = payload();
      if (id) {
        const { error } = await supabase.from("host_listings").update(data).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data: row, error } = await supabase.from("host_listings").insert({ ...data, owner_id: userId, status: "brouillon" }).select("id").single();
      if (error) throw error;
      setId(row.id);
      window.history.replaceState(null, "", `?id=${row.id}`);
      return row.id;
    })();
    saving.current = run;
    try { const r = await run; setSave("saved"); return r; }
    catch (err) { console.error(err); dirty.current = true; setSave("error"); return undefined; }
    finally { saving.current = null; }
  }, [id, payload, userId]);

  // Debounced autosave on any change
  useEffect(() => {
    if (!loaded) return;
    dirty.current = true;
    const t = setTimeout(() => { void saveDraft(); }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, sizes, equipment, blocked, rules, photos, loaded]);

  const goTo = async (n: number) => { await saveDraft(); setStep(n); window.scrollTo({ top: 0 }); };

  const addFiles = async (list: FileList | File[] | null) => {
    if (!list) return;
    const room = MAX_PHOTOS - photos.length - uploading;
    const valid = Array.from(list).filter((file) => {
      if (!file.type.startsWith("image/")) { toast.error(`${file.name} n'est pas une image.`); return false; }
      if (file.size > 8 * 1024 * 1024) { toast.error(`${file.name} dépasse 8 Mo.`); return false; }
      return true;
    });
    if (valid.length > room) toast.error(`${MAX_PHOTOS} photos maximum.`);
    const batch = valid.slice(0, Math.max(0, room));
    setUploading((u) => u + batch.length);
    await Promise.all(batch.map(async (file) => {
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { contentType: file.type });
      setUploading((u) => u - 1);
      if (error) { toast.error(`Échec de l'envoi de ${file.name}.`); return; }
      const [url] = await photoUrls([path]);
      setPhotos((cur) => [...cur, { path, url: url ?? "" }]);
    }));
  };

  const removePhoto = async (p: Photo) => {
    setPhotos((cur) => cur.filter((x) => x.path !== p.path));
    await supabase.storage.from(PHOTO_BUCKET).remove([p.path]);
  };
  const makeCover = (i: number) => setPhotos((cur) => [cur[i]!, ...cur.filter((_, j) => j !== i)]);

  const publish = async () => {
    const parsed = listingSchema.safeParse({
      name: f.name, type: f.type, city: f.city, region: f.region, description: f.description,
      price_per_night: f.price === "" ? NaN : Number(f.price), dog_fee_per_night: Number(f.dogFee || 0), cleaning_fee: Number(f.cleaning || 0),
      min_nights: Number(f.minNights || 1), available_from: f.from, available_to: f.to, blocked_dates: blocked,
      fenced_garden: f.fenced, sizes, max_dogs: Number(f.maxDogs || 1), equipment, dog_rules: rules,
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Formulaire incomplet"); return; }
    if (photos.length < 3) { toast.error("Ajoutez au moins 3 photos."); setStep(1); return; }
    setPublishing(true);
    dirty.current = true;
    const savedId = await saveDraft();
    if (!savedId) { setPublishing(false); toast.error("Enregistrement impossible. Réessayez."); return; }
    const { error } = await supabase.from("host_listings").update({ status: "publiée" }).eq("id", savedId);
    setPublishing(false);
    if (error) { toast.error("La publication a échoué. Réessayez."); return; }
    toast.success("Logement publié !");
    navigate({ to: "/mes-annonces" });
  };

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((cur) => ({ ...cur, [k]: e.target.value }));
  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  if (!loaded) return <p className="mx-auto max-w-3xl px-4 py-10 text-muted-foreground">Chargement du brouillon…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">{draftId ? "Reprendre mon annonce" : "Ajouter un logement"}</h1>
          <p className="mt-1 text-muted-foreground">Votre annonce est enregistrée en brouillon automatiquement.</p>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-live="polite">
          {save === "saving" && <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement…</>}
          {save === "saved" && <><Check className="h-4 w-4" />Brouillon enregistré</>}
          {save === "error" && <span className="text-destructive">Échec de l'enregistrement — nouvel essai à la prochaine modification</span>}
        </p>
      </div>

      <ol className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => goTo(i)} aria-current={i === step ? "step" : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-muted" : ""}`}>
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>

      <section className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold">{STEPS[step]}</h2>

        {step === 0 && <>
          <div className="space-y-1.5"><Label htmlFor="name">Nom de l'annonce</Label><Input id="name" value={f.name} onChange={set("name")} maxLength={120} placeholder="Ex. Gîte du Moulin" /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5"><Label htmlFor="type">Type</Label>
              <select id="type" value={f.type} onChange={set("type")} className="h-9 w-full rounded-md border bg-background px-3 text-sm"><option value="">Choisir…</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div className="space-y-1.5"><Label htmlFor="city">Ville</Label><Input id="city" value={f.city} onChange={set("city")} maxLength={80} /></div>
            <div className="space-y-1.5"><Label htmlFor="region">Région</Label><Input id="region" value={f.region} onChange={set("region")} maxLength={80} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="desc">Description</Label><Textarea id="desc" rows={4} value={f.description} onChange={set("description")} maxLength={2000} /></div>
        </>}

        {step === 1 && <>
          <p className="text-sm text-muted-foreground">Entre 3 et {MAX_PHOTOS} photos réelles. Glissez-déposez vos images ou cliquez pour les choisir. La première est la photo principale.</p>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); void addFiles(e.dataTransfer.files); }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center text-sm transition-colors ${dragOver ? "border-primary bg-primary/5" : "text-muted-foreground hover:bg-muted"}`}>
            <ImagePlus className="h-8 w-8" />
            <span className="font-medium">Déposez vos photos ici</span>
            <span>ou cliquez pour parcourir · 8 Mo max par photo · {photos.length}/{MAX_PHOTOS}</span>
            <input type="file" accept="image/*" multiple className="sr-only" disabled={photos.length >= MAX_PHOTOS}
              onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((p, i) => (
              <div key={p.path} className="relative aspect-[4/3] overflow-hidden rounded-xl border">
                <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                {i === 0 ? <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-semibold">Principale</span>
                  : <button type="button" onClick={() => makeCover(i)} className="absolute bottom-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-xs">Mettre en principale</button>}
                <Button type="button" size="icon" variant="secondary" className="absolute right-1 top-1 h-7 w-7" aria-label={`Retirer la photo ${i + 1}`} onClick={() => removePhoto(p)}><X /></Button>
              </div>
            ))}
            {Array.from({ length: uploading }).map((_, i) => (
              <div key={`up-${i}`} className="flex aspect-[4/3] items-center justify-center rounded-xl border bg-muted"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ))}
          </div>
        </>}

        {step === 2 && <>
          <p className="text-sm text-muted-foreground">La commission de service PetInn est payée par le voyageur, elle ne s'ajoute pas à vos tarifs.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="price">Prix par nuit (€)</Label><Input id="price" type="number" min={1} value={f.price} onChange={set("price")} /></div>
            <div className="space-y-1.5"><Label htmlFor="dogfee">Supplément par chien et par nuit (€)</Label><Input id="dogfee" type="number" min={0} value={f.dogFee} onChange={set("dogFee")} /></div>
            <div className="space-y-1.5"><Label htmlFor="cleaning">Frais de ménage (€)</Label><Input id="cleaning" type="number" min={0} value={f.cleaning} onChange={set("cleaning")} /></div>
            <div className="space-y-1.5"><Label htmlFor="min">Séjour minimum (nuits)</Label><Input id="min" type="number" min={1} max={60} value={f.minNights} onChange={set("minNights")} /></div>
          </div>
        </>}

        {step === 3 && <>
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
        </>}

        {step === 4 && <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="maxdogs">Nombre de chiens maximum</Label><Input id="maxdogs" type="number" min={1} max={10} value={f.maxDogs} onChange={set("maxDogs")} /></div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm"><Checkbox checked={f.fenced} onCheckedChange={(v) => setF((cur) => ({ ...cur, fenced: v === true }))} />Jardin entièrement clôturé</label>
          </div>
          <div><p className="mb-2 text-sm font-medium">Gabarits acceptés</p>
            <div className="flex flex-wrap gap-2">{SIZES.map((s) => (
              <button type="button" key={s} onClick={() => setSizes(toggleIn(sizes, s))} className={`rounded-full border px-4 py-1.5 text-sm capitalize ${sizes.includes(s) ? "bg-primary text-primary-foreground" : ""}`}>{s}</button>))}</div></div>
          <div><p className="mb-2 text-sm font-medium">Équipements fournis</p>
            <div className="grid gap-2 sm:grid-cols-2">{EQUIPMENT.map((e) => (
              <label key={e} className="flex items-center gap-2 text-sm"><Checkbox checked={equipment.includes(e)} onCheckedChange={() => setEquipment(toggleIn(equipment, e))} />{e}</label>))}</div></div>
        </>}

        {step === 5 && <>
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
        </>}
      </section>

      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="ghost" onClick={async () => { await saveDraft(); navigate({ to: "/mes-annonces" }); }}>Enregistrer et quitter</Button>
        <div className="flex gap-2">
          {step > 0 && <Button type="button" variant="outline" onClick={() => goTo(step - 1)}>Précédent</Button>}
          {step < STEPS.length - 1
            ? <Button type="button" onClick={() => goTo(step + 1)}>Suivant</Button>
            : <Button type="button" onClick={publish} disabled={publishing || uploading > 0}>{publishing ? "Publication…" : "Publier le logement"}</Button>}
        </div>
      </div>
    </div>
  );
}
