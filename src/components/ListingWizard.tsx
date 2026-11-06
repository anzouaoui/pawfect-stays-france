import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EQUIPMENT, TYPES, type Size } from "@/lib/data";
import { MAX_PHOTOS, PHOTO_BUCKET, photoUrls } from "@/lib/host-listings";
import { FENCE_HEIGHT, MIN_PHOTOS, fenceRule, splitFenceRule, validateWizard, type WizardInput } from "@/lib/listing-schema";
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

type Form = { name: string; type: string; city: string; region: string; description: string; price: string; dogFee: string; cleaning: string; minNights: string; from: string; to: string; maxDogs: string; fenced: boolean | null; fenceHeight: string };
type Photo = { path: string; url: string };
type SaveState = "idle" | "saving" | "saved" | "error";

const EMPTY: Form = { name: "", type: "", city: "", region: "", description: "", price: "", dogFee: "0", cleaning: "0", minNights: "1", from: "", to: "", maxDogs: "1", fenced: null, fenceHeight: "" };
/** "" → NaN (required field left empty); "1,5" → 1.5. */
const num = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(",", ".")));
/** Optional fee: empty means 0. */
const fee = (v: string) => (v.trim() === "" ? 0 : num(v));

/** Inline error under a field; `id` is referenced by the field's aria-describedby. */
function FieldError({ id, message }: { id: string; message?: string | undefined }) {
  return message ? <p id={id} role="alert" className="text-sm text-destructive">{message}</p> : null;
}

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
        minNights: String(data.min_nights), from: data.available_from, to: data.available_to, maxDogs: String(data.max_dogs),
        // A draft stores false until answered: ask again rather than assume "no garden".
        fenced: data.fenced_garden ? true : data.status === "publiée" ? false : null, fenceHeight: "" });
      setSizes(data.sizes as Size[]); setEquipment(data.equipment); setBlocked(data.blocked_dates);
      const stored = Array.isArray(data.dog_rules) ? (data.dog_rules as { title: string; description: string }[]) : [];
      const { rules: own, fenceHeightM } = splitFenceRule(stored);
      if (fenceHeightM !== null) setF((cur) => ({ ...cur, fenceHeight: String(fenceHeightM).replace(".", ",") }));
      setRules(own.length || stored.length ? own : DEFAULT_RULES);
      const urls = await photoUrls(data.photos);
      setPhotos(data.photos.map((path, i) => ({ path, url: urls[i] ?? "" })));
      setLoaded(true);
    })();
  }, [draftId, userId, navigate]);

  /** Exactly what the host entered, for validation before publishing. */
  const wizardInput = useMemo((): WizardInput => ({
    name: f.name, type: f.type, city: f.city, region: f.region, description: f.description,
    price_per_night: num(f.price), dog_fee_per_night: fee(f.dogFee), cleaning_fee: fee(f.cleaning),
    min_nights: num(f.minNights), available_from: f.from, available_to: f.to, blocked_dates: blocked,
    fenced_garden: f.fenced, fence_height_m: f.fenced ? (f.fenceHeight.trim() ? num(f.fenceHeight) : null) : null,
    sizes, max_dogs: num(f.maxDogs), equipment, dog_rules: rules, photos: photos.map((p) => p.path),
  }), [f, blocked, sizes, equipment, rules, photos]);

  /** Draft row: incomplete values are replaced by safe defaults so autosave never fails on constraints. */
  const payload = useCallback(() => {
    const h = wizardInput.fence_height_m;
    const fenceOk = wizardInput.fenced_garden === true && h !== null && h >= FENCE_HEIGHT.min && h <= FENCE_HEIGHT.max;
    return {
      name: f.name.trim(), type: f.type, city: f.city.trim(), region: f.region.trim(), description: f.description.trim(),
      price_per_night: Number(f.price.replace(",", ".")) || 0, dog_fee_per_night: Math.max(0, Number(f.dogFee.replace(",", ".")) || 0), cleaning_fee: Math.max(0, Number(f.cleaning.replace(",", ".")) || 0),
      min_nights: Math.min(60, Math.max(1, Math.round(Number(f.minNights) || 1))), available_from: f.from || today(), available_to: f.to || f.from || today(),
      blocked_dates: blocked, fenced_garden: f.fenced === true, sizes, max_dogs: Math.min(10, Math.max(1, Math.round(Number(f.maxDogs) || 1))), equipment,
      dog_rules: fenceOk ? [...rules, fenceRule(h)] : rules, photos: photos.map((p) => p.path),
    };
  }, [f, wizardInput, blocked, sizes, equipment, rules, photos]);

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

  // Errors appear after a first publish attempt, then update live as the host fixes them.
  const [showErrors, setShowErrors] = useState(false);
  const check = useMemo(() => validateWizard(wizardInput, today()), [wizardInput]);
  const errors: Record<string, string> = showErrors && !check.ok ? check.errors : {};
  const stepHasError = (i: number) => showErrors && !check.ok && check.stepsWithErrors.includes(i);
  const err = (key: string) => errors[key];
  const invalid = (key: string) => (errors[key] ? { "aria-invalid": true, "aria-describedby": `err-${key}` } : {});

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
    if (!check.ok) {
      setShowErrors(true);
      setStep(check.firstStep);
      window.scrollTo({ top: 0 });
      const n = Object.keys(check.errors).length;
      toast.error(`${n} point${n > 1 ? "s" : ""} à corriger avant de publier`, { description: Object.values(check.errors)[0] });
      return;
    }
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

  const set = (k: Exclude<keyof Form, "fenced">) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((cur) => ({ ...cur, [k]: e.target.value }));
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
              className={`rounded-full border px-3 py-1 text-sm ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-muted" : ""} ${stepHasError(i) ? "border-destructive text-destructive" : ""} ${stepHasError(i) && i === step ? "text-primary-foreground" : ""}`}>
              {i + 1}. {s}{stepHasError(i) && <span aria-label=" — à corriger"> ⚠</span>}
            </button>
          </li>
        ))}
      </ol>

      <section className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold">{STEPS[step]}</h2>

        {step === 0 && <>
          <div className="space-y-1.5"><Label htmlFor="name">Nom de l'annonce</Label><Input id="name" value={f.name} onChange={set("name")} maxLength={120} placeholder="Ex. Gîte du Moulin" {...invalid("name")} /><FieldError id="err-name" message={err("name")} /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5"><Label htmlFor="type">Type</Label>
              <select id="type" value={f.type} onChange={set("type")} className="h-9 w-full rounded-md border bg-background px-3 text-sm" {...invalid("type")}><option value="">Choisir…</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select><FieldError id="err-type" message={err("type")} /></div>
            <div className="space-y-1.5"><Label htmlFor="city">Ville</Label><Input id="city" value={f.city} onChange={set("city")} maxLength={80} {...invalid("city")} /><FieldError id="err-city" message={err("city")} /></div>
            <div className="space-y-1.5"><Label htmlFor="region">Région</Label><Input id="region" value={f.region} onChange={set("region")} maxLength={80} {...invalid("region")} /><FieldError id="err-region" message={err("region")} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="desc">Description</Label><Textarea id="desc" rows={4} value={f.description} onChange={set("description")} maxLength={2000} {...invalid("description")} /><FieldError id="err-description" message={err("description")} /></div>
        </>}

        {step === 1 && <>
          <p className="text-sm text-muted-foreground">Entre {MIN_PHOTOS} et {MAX_PHOTOS} photos réelles, obligatoires pour publier. Glissez-déposez vos images ou cliquez pour les choisir. La première est la photo principale.</p>
          <FieldError id="err-photos" message={err("photos")} />
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
            <div className="space-y-1.5"><Label htmlFor="price">Prix par nuit (€)</Label><Input id="price" type="number" inputMode="decimal" min={1} step="0.01" required value={f.price} onChange={set("price")} {...invalid("price_per_night")} /><FieldError id="err-price_per_night" message={err("price_per_night")} /></div>
            <div className="space-y-1.5"><Label htmlFor="dogfee">Supplément par chien et par nuit (€)</Label><Input id="dogfee" type="number" inputMode="decimal" min={0} step="0.01" value={f.dogFee} onChange={set("dogFee")} {...invalid("dog_fee_per_night")} /><FieldError id="err-dog_fee_per_night" message={err("dog_fee_per_night")} /></div>
            <div className="space-y-1.5"><Label htmlFor="cleaning">Frais de ménage (€)</Label><Input id="cleaning" type="number" inputMode="decimal" min={0} step="0.01" value={f.cleaning} onChange={set("cleaning")} {...invalid("cleaning_fee")} /><FieldError id="err-cleaning_fee" message={err("cleaning_fee")} /></div>
            <div className="space-y-1.5"><Label htmlFor="min">Séjour minimum (nuits)</Label><Input id="min" type="number" inputMode="numeric" min={1} max={60} step={1} value={f.minNights} onChange={set("minNights")} {...invalid("min_nights")} /><FieldError id="err-min_nights" message={err("min_nights")} /></div>
          </div>
        </>}

        {step === 3 && <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="from">Ouvert à partir du</Label><Input id="from" type="date" required value={f.from} onChange={set("from")} {...invalid("available_from")} /><FieldError id="err-available_from" message={err("available_from")} /></div>
            <div className="space-y-1.5"><Label htmlFor="to">Jusqu'au</Label><Input id="to" type="date" required min={f.from || today()} value={f.to} onChange={set("to")} {...invalid("available_to")} /><FieldError id="err-available_to" message={err("available_to")} /></div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="block">Dates indisponibles</Label>
            <div className="flex gap-2">
              <Input id="block" type="date" min={f.from} max={f.to} value={blockInput} onChange={(e) => setBlockInput(e.target.value)} />
              <Button type="button" variant="outline" onClick={() => { if (blockInput && !blocked.includes(blockInput)) setBlocked([...blocked, blockInput].sort()); setBlockInput(""); }}>Bloquer</Button>
            </div>
            <div className="flex flex-wrap gap-2">{blocked.map((d) => (
              <button type="button" key={d} onClick={() => setBlocked(blocked.filter((x) => x !== d))} aria-label={`Débloquer le ${new Date(`${d}T00:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC" })}`} className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${(f.from && d < f.from) || (f.to && d > f.to) ? "border-destructive text-destructive" : ""}`}>{new Date(`${d}T00:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC" })}<X className="h-3 w-3" /></button>))}</div>
            <FieldError id="err-blocked_dates" message={err("blocked_dates")} />
          </div>
        </>}

        {step === 4 && <>
          <div className="space-y-1.5 sm:w-1/2"><Label htmlFor="maxdogs">Nombre de chiens maximum</Label><Input id="maxdogs" type="number" inputMode="numeric" min={1} max={10} step={1} value={f.maxDogs} onChange={set("maxDogs")} {...invalid("max_dogs")} /><FieldError id="err-max_dogs" message={err("max_dogs")} /></div>
          <fieldset className="space-y-2" {...invalid("fenced_garden")}>
            <legend className="text-sm font-medium">Le jardin est-il entièrement clôturé ?</legend>
            <div role="radiogroup" aria-label="Jardin entièrement clôturé" className="flex flex-wrap gap-2">
              {([[true, "Oui, entièrement clôturé"], [false, "Non, ou pas de jardin"]] as const).map(([v, label]) => (
                <button type="button" key={String(v)} role="radio" aria-checked={f.fenced === v} onClick={() => setF((cur) => ({ ...cur, fenced: v }))}
                  className={`rounded-full border px-4 py-1.5 text-sm ${f.fenced === v ? "bg-primary text-primary-foreground" : ""}`}>{label}</button>))}
            </div>
            <FieldError id="err-fenced_garden" message={err("fenced_garden")} />
          </fieldset>
          {f.fenced === true && (
            <div className="space-y-1.5 sm:w-1/2">
              <Label htmlFor="fence">Hauteur de la clôture (m)</Label>
              <Input id="fence" type="number" inputMode="decimal" min={FENCE_HEIGHT.min} max={FENCE_HEIGHT.max} step="0.05" placeholder="Ex. 1,50" value={f.fenceHeight} onChange={set("fenceHeight")} {...invalid("fence_height_m")} />
              <p className="text-xs text-muted-foreground">Affichée aux voyageurs pour qu’ils sachent si leur chien peut sauter la clôture.</p>
              <FieldError id="err-fence_height_m" message={err("fence_height_m")} />
            </div>
          )}
          <div><p className="mb-2 text-sm font-medium">Gabarits acceptés</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Gabarits acceptés" {...invalid("sizes")}>{SIZES.map((s) => (
              <button type="button" key={s} aria-pressed={sizes.includes(s)} onClick={() => setSizes(toggleIn(sizes, s))} className={`rounded-full border px-4 py-1.5 text-sm capitalize ${sizes.includes(s) ? "bg-primary text-primary-foreground" : ""}`}>{s}</button>))}</div>
            <FieldError id="err-sizes" message={err("sizes")} /></div>
          <div><p className="mb-2 text-sm font-medium">Équipements fournis</p>
            <div className="grid gap-2 sm:grid-cols-2">{EQUIPMENT.map((e) => (
              <label key={e} className="flex items-center gap-2 text-sm"><Checkbox checked={equipment.includes(e)} onCheckedChange={() => setEquipment(toggleIn(equipment, e))} />{e}</label>))}</div></div>
        </>}

        {step === 5 && <>
          {rules.map((r, i) => (
            <div key={i} className="space-y-2 rounded-xl border p-3">
              <div className="flex gap-2">
                <Input aria-label={`Titre de la règle ${i + 1}`} value={r.title} maxLength={80} placeholder="Titre" {...invalid(`dog_rules.${i}.title`)} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <Button type="button" variant="ghost" size="icon" aria-label={`Supprimer la règle ${i + 1}`} onClick={() => setRules(rules.filter((_, j) => j !== i))}><Trash2 /></Button>
              </div>
              <FieldError id={`err-dog_rules.${i}.title`} message={err(`dog_rules.${i}.title`)} />
              <Textarea aria-label={`Description de la règle ${i + 1}`} rows={2} value={r.description} maxLength={500} placeholder="Détail de la règle" {...invalid(`dog_rules.${i}.description`)} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
              <FieldError id={`err-dog_rules.${i}.description`} message={err(`dog_rules.${i}.description`)} />
            </div>
          ))}
          {f.fenced === true && <p className="text-sm text-muted-foreground">La règle « Clôture du jardin » (hauteur de la clôture) sera ajoutée automatiquement.</p>}
          <FieldError id="err-dog_rules" message={err("dog_rules")} />
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
