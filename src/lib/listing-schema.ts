import { z } from "zod";
import { EQUIPMENT, TYPES } from "@/lib/data";

/**
 * Validation of a host listing, shared by the publishing wizard (browser) and the seed
 * script (Node/Bun). Kept free of any Supabase client import so both can use it.
 * Every rule carries a French message: no default (English) Zod message reaches the host.
 */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const euros = (label: string, { min, max }: { min: number; max: number }) =>
  z.number({ message: `${label} : indiquez un montant en euros` })
    .finite(`${label} : indiquez un montant en euros`)
    .min(min, min > 0 ? `${label} : le montant doit être supérieur à 0 €` : `${label} : le montant ne peut pas être négatif`)
    .max(max, `${label} : ${max.toLocaleString("fr-FR")} € maximum`);
const wholeNumber = (label: string, min: number, max: number) =>
  z.number({ message: `${label} : indiquez un nombre` })
    .int(`${label} : indiquez un nombre entier`)
    .min(min, `${label} : ${min} minimum`)
    .max(max, `${label} : ${max} maximum`);
const day = (label: string) => z.string({ message: `${label} : date requise` }).regex(ISO_DAY, `${label} : date requise`);

export const ruleSchema = z.object({
  title: z.string().trim().min(2, "Titre de la règle trop court (2 caractères min.)").max(80, "Titre de la règle trop long (80 caractères max.)"),
  description: z.string().trim().min(10, "Décrivez la règle (10 caractères min.)").max(500, "Description de la règle trop longue (500 caractères max.)"),
});

export const listingFields = z.object({
  name: z.string().trim().min(3, "Nom de l’annonce trop court (3 caractères min.)").max(120, "Nom de l’annonce trop long (120 caractères max.)"),
  type: z.enum(TYPES as [string, ...string[]], { message: "Choisissez le type de logement" }),
  city: z.string().trim().min(2, "Indiquez la ville").max(80, "Nom de ville trop long (80 caractères max.)"),
  region: z.string().trim().max(80, "Nom de région trop long (80 caractères max.)"),
  description: z.string().trim().min(20, "Décrivez le logement (20 caractères min.)").max(2000, "Description trop longue (2000 caractères max.)"),
  price_per_night: euros("Prix par nuit", { min: 0.01, max: 10000 }),
  dog_fee_per_night: euros("Supplément par chien", { min: 0, max: 500 }),
  cleaning_fee: euros("Frais de ménage", { min: 0, max: 2000 }),
  min_nights: wholeNumber("Séjour minimum", 1, 60),
  available_from: day("Date d’ouverture"),
  available_to: day("Date de fin"),
  blocked_dates: z.array(z.string().regex(ISO_DAY, "Date indisponible invalide")),
  fenced_garden: z.boolean({ message: "Précisez si le jardin est entièrement clôturé" }),
  sizes: z.array(z.enum(["petit", "moyen", "grand"]), { message: "Choisissez au moins un gabarit" }).min(1, "Choisissez au moins un gabarit accepté"),
  max_dogs: wholeNumber("Nombre de chiens maximum", 1, 10),
  equipment: z.array(z.enum(EQUIPMENT as [string, ...string[]], { message: "Équipement inconnu" })),
  dog_rules: z.array(ruleSchema).min(1, "Ajoutez au moins une règle d’accueil des chiens"),
});

export const listingSchema = listingFields
  .refine((v) => v.available_to >= v.available_from, { message: "La date de fin doit suivre la date d’ouverture", path: ["available_to"] })
  .refine((v) => v.blocked_dates.every((d) => d >= v.available_from && d <= v.available_to), {
    message: "Les dates indisponibles doivent être comprises dans la période d’ouverture", path: ["blocked_dates"],
  });

export type ListingInput = z.infer<typeof listingSchema>;

// ---------------------------------------------------------------------------------------
// Publishing wizard: listing + photos + explicit garden answer and fence height.

export const MIN_PHOTOS = 3;
export const MAX_LISTING_PHOTOS = 10;
export const FENCE_HEIGHT = { min: 0.5, max: 3 } as const;
export const FENCE_RULE_TITLE = "Clôture du jardin";

/** Raw wizard values: numbers may be NaN (empty field), the garden answer null (not chosen yet). */
export type WizardInput = Omit<ListingInput, "fenced_garden"> & {
  fenced_garden: boolean | null;
  fence_height_m: number | null;
  photos: string[];
};

export const wizardSchema = listingFields
  .extend({
    fenced_garden: z.boolean({ message: "Précisez si le jardin est entièrement clôturé (oui ou non)" }),
    fence_height_m: z.number({ message: "Indiquez la hauteur de la clôture (en mètres)" }).nullable(),
    photos: z.array(z.string())
      .min(MIN_PHOTOS, `Ajoutez au moins ${MIN_PHOTOS} photos réelles du logement`)
      .max(MAX_LISTING_PHOTOS, `${MAX_LISTING_PHOTOS} photos maximum`),
  })
  .superRefine((v, ctx) => {
    for (const [path, message] of crossFieldIssues(v)) ctx.addIssue({ code: "custom", path: [path], message });
  });

/**
 * Checks spanning several fields. Run on the raw input too, so they are reported together
 * with basic field errors instead of only once those are fixed.
 */
function crossFieldIssues(v: Pick<WizardInput, "available_from" | "available_to" | "blocked_dates" | "fenced_garden" | "fence_height_m" | "dog_rules">): [string, string][] {
  const issues: [string, string][] = [];
  const datesOk = ISO_DAY.test(v.available_from) && ISO_DAY.test(v.available_to);
  if (datesOk && v.available_to < v.available_from) issues.push(["available_to", "La date de fin doit suivre la date d’ouverture"]);
  if (datesOk && !v.blocked_dates.every((d) => d >= v.available_from && d <= v.available_to)) {
    issues.push(["blocked_dates", "Les dates indisponibles doivent être comprises dans la période d’ouverture"]);
  }
  if (v.fenced_garden === true) {
    const h = v.fence_height_m;
    if (h === null || !Number.isFinite(h)) issues.push(["fence_height_m", "Indiquez la hauteur de la clôture (en mètres)"]);
    else if (h < FENCE_HEIGHT.min || h > FENCE_HEIGHT.max) {
      issues.push(["fence_height_m", `Hauteur de clôture entre ${formatMeters(FENCE_HEIGHT.min)} et ${formatMeters(FENCE_HEIGHT.max)}`]);
    }
  }
  if (v.dog_rules.some((r) => r.title.trim().toLowerCase() === FENCE_RULE_TITLE.toLowerCase())) {
    issues.push(["dog_rules", `« ${FENCE_RULE_TITLE} » est ajouté automatiquement : retirez cette règle`]);
  }
  return issues;
}

/** Wizard step (0-based) where each field is edited. */
export const STEP_OF_FIELD: Record<string, number> = {
  name: 0, type: 0, city: 0, region: 0, description: 0,
  photos: 1,
  price_per_night: 2, dog_fee_per_night: 2, cleaning_fee: 2, min_nights: 2,
  available_from: 3, available_to: 3, blocked_dates: 3,
  fenced_garden: 4, fence_height_m: 4, sizes: 4, max_dogs: 4, equipment: 4,
  dog_rules: 5,
};

export type WizardCheck =
  | { ok: true; data: z.infer<typeof wizardSchema> }
  | { ok: false; errors: Record<string, string>; firstStep: number; stepsWithErrors: number[] };

/**
 * Validates the wizard before publishing. `today` ("YYYY-MM-DD") rejects an opening period
 * that is already over. Errors are keyed by field path ("price_per_night", "dog_rules.1.title"),
 * keeping the first message for each.
 */
export function validateWizard(input: WizardInput, today: string): WizardCheck {
  const parsed = wizardSchema.safeParse(input);
  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "form";
      errors[key] ??= issue.message;
    }
  }
  if (!parsed.success) for (const [key, message] of crossFieldIssues(input)) errors[key] ??= message;
  if (ISO_DAY.test(input.available_to) && input.available_to < today) {
    errors["available_to"] ??= "La période d’ouverture est déjà terminée : choisissez une date de fin à venir";
  }
  const keys = Object.keys(errors);
  if (!keys.length && parsed.success) return { ok: true, data: parsed.data };
  const steps = [...new Set(keys.map((k) => STEP_OF_FIELD[k.split(".")[0]!] ?? 0))].sort((a, b) => a - b);
  return { ok: false, errors, firstStep: steps[0] ?? 0, stepsWithErrors: steps };
}

export function formatMeters(m: number) {
  return `${m.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
}

/**
 * The fence height is published as a dog rule (no dedicated column), so travelers see it on
 * the listing page; it is read back from that rule when a draft is resumed.
 */
export function fenceRule(heightM: number) {
  return { title: FENCE_RULE_TITLE, description: `Jardin entièrement clôturé, clôture de ${formatMeters(heightM)} de hauteur.` };
}

/** Splits stored rules into the host's own rules and the fence height, if present. */
export function splitFenceRule(rules: { title: string; description: string }[]) {
  const fence = rules.find((r) => r.title === FENCE_RULE_TITLE);
  const match = fence?.description.match(/(\d+(?:[.,]\d+)?)\s*m\b/);
  return {
    rules: rules.filter((r) => r !== fence),
    fenceHeightM: match ? Number(match[1]!.replace(",", ".")) : null,
  };
}
