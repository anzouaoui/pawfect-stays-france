import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type HostListing = Tables<"host_listings">;
export const PHOTO_BUCKET = "listing-photos";
export const MAX_PHOTOS = 10;

export const ruleSchema = z.object({
  title: z.string().trim().min(2, "Titre trop court").max(80),
  description: z.string().trim().min(10, "Décrivez la règle (10 caractères min.)").max(500),
});

export const listingSchema = z
  .object({
    name: z.string().trim().min(3, "Nom trop court").max(120),
    type: z.string().min(1, "Choisissez un type"),
    city: z.string().trim().min(2, "Ville requise").max(80),
    region: z.string().trim().max(80),
    description: z.string().trim().min(20, "Décrivez le logement (20 caractères min.)").max(2000),
    price_per_night: z.number({ message: "Tarif requis" }).positive("Le tarif doit être positif").max(10000),
    dog_fee_per_night: z.number().min(0).max(500),
    cleaning_fee: z.number().min(0).max(2000),
    min_nights: z.number().int().min(1).max(60),
    available_from: z.string().min(1, "Date de début requise"),
    available_to: z.string().min(1, "Date de fin requise"),
    blocked_dates: z.array(z.string()),
    fenced_garden: z.boolean(),
    sizes: z.array(z.enum(["petit", "moyen", "grand"])).min(1, "Choisissez au moins un gabarit"),
    max_dogs: z.number().int().min(1).max(10),
    equipment: z.array(z.string()),
    dog_rules: z.array(ruleSchema).min(1, "Ajoutez au moins une règle canine"),
  })
  .refine((v) => v.available_to >= v.available_from, { message: "La fin doit suivre le début", path: ["available_to"] });

export type ListingInput = z.infer<typeof listingSchema>;

export async function photoUrls(paths: string[]) {
  if (!paths.length) return [] as string[];
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60);
  return (data ?? []).map((d) => d.signedUrl ?? "").filter(Boolean);
}
