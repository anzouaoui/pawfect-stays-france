import { z } from "zod";
import { EQUIPMENT, TYPES } from "@/lib/data";
import { listingFields } from "@/lib/listing-schema";

/**
 * Seed file format for scripts/seed-listings.ts (see docs/seeding-listings.md).
 * Each entry is validated with the same rules as the publishing wizard, plus:
 * - a known accommodation type and known dog equipment (so search filters match),
 * - 1 to 10 local photo files (jpg, jpeg, png, webp), uploaded to the listing-photos bucket,
 * - no `example: true` marker (template entries must be replaced by real listings).
 */
export const PHOTO_EXTENSIONS = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export const seedEntrySchema = listingFields
  .extend({
    type: z.enum(TYPES as [string, ...string[]], { message: `Type inconnu (attendu : ${TYPES.join(", ")})` }),
    available_from: z.string().regex(ISO_DAY, "Date au format AAAA-MM-JJ"),
    available_to: z.string().regex(ISO_DAY, "Date au format AAAA-MM-JJ"),
    blocked_dates: z.array(z.string().regex(ISO_DAY, "Date au format AAAA-MM-JJ")).default([]),
    equipment: z.array(z.enum(EQUIPMENT as [string, ...string[]], { message: `Équipement inconnu (attendu : ${EQUIPMENT.join(", ")})` })),
    photos: z.array(z.string().refine((p) => extensionOf(p) in PHOTO_EXTENSIONS, "Photo en .jpg, .jpeg, .png ou .webp")).min(1, "Au moins une photo réelle du logement").max(10),
    example: z.boolean().optional(),
  })
  .refine((v) => v.available_to >= v.available_from, { message: "La fin doit suivre le début", path: ["available_to"] })
  .refine((v) => v.blocked_dates.every((d) => d >= v.available_from && d <= v.available_to), {
    message: "Les dates bloquées doivent être dans la période de disponibilité", path: ["blocked_dates"],
  });

export type SeedEntry = z.infer<typeof seedEntrySchema>;

export const seedFileSchema = z.object({ listings: z.array(seedEntrySchema).min(1, "Aucune annonce dans le fichier") });

export function extensionOf(path: string) {
  return path.split(".").pop()?.toLowerCase() ?? "";
}

export type SeedReport = { entries: SeedEntry[]; errors: string[]; warnings: string[] };

/** Validates a parsed seed file. `today` is "YYYY-MM-DD". Never throws. */
export function validateSeedFile(json: unknown, today: string): SeedReport {
  const parsed = seedFileSchema.safeParse(json);
  if (!parsed.success) {
    return {
      entries: [], warnings: [],
      errors: parsed.error.issues.map((i) => `${formatPath(i.path, json)} : ${i.message}`),
    };
  }
  const entries = parsed.data.listings;
  const errors: string[] = [];
  const warnings: string[] = [];
  const names = new Set<string>();
  entries.forEach((e, i) => {
    const label = `annonce ${i + 1} (${e.name})`;
    if (e.example) errors.push(`${label} : exemple du modèle — remplacez-la par un vrai logement et retirez "example": true.`);
    const key = e.name.trim().toLowerCase();
    if (names.has(key)) errors.push(`${label} : nom en double dans le fichier.`);
    names.add(key);
    if (e.available_to < today) errors.push(`${label} : disponibilités déjà passées (fin le ${e.available_to}).`);
    else if (e.available_from < today) warnings.push(`${label} : début de disponibilité dans le passé, seules les dates à venir seront réservables.`);
    if (e.max_dogs > 1 && e.dog_fee_per_night === 0) warnings.push(`${label} : aucun supplément chien par nuit.`);
    if (e.photos.length < 3) warnings.push(`${label} : seulement ${e.photos.length} photo(s), 3 ou plus recommandées.`);
  });
  return { entries, errors, warnings };
}

function formatPath(path: PropertyKey[], json: unknown) {
  if (path[0] === "listings" && typeof path[1] === "number") {
    const name = (json as { listings?: { name?: unknown }[] })?.listings?.[path[1]]?.name;
    return `annonce ${path[1] + 1}${typeof name === "string" ? ` (${name})` : ""} › ${path.slice(2).join(".") || "contenu"}`;
  }
  return path.join(".") || "fichier";
}

/** Database row for host_listings, once photos are uploaded under `<ownerId>/…`. */
export function toListingRow(e: SeedEntry, ownerId: string, photoPaths: string[]) {
  return {
    owner_id: ownerId, status: "publiée" as const,
    name: e.name.trim(), type: e.type, city: e.city.trim(), region: e.region.trim(), description: e.description.trim(),
    price_per_night: e.price_per_night, dog_fee_per_night: e.dog_fee_per_night, cleaning_fee: e.cleaning_fee,
    min_nights: e.min_nights, available_from: e.available_from, available_to: e.available_to,
    blocked_dates: [...new Set(e.blocked_dates)].sort(), fenced_garden: e.fenced_garden,
    sizes: e.sizes, max_dogs: e.max_dogs, equipment: e.equipment, dog_rules: e.dog_rules, photos: photoPaths,
  };
}
