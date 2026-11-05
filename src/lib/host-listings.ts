import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type HostListing = Tables<"host_listings">;
export const PHOTO_BUCKET = "listing-photos";
export const MAX_PHOTOS = 10;

export { ruleSchema, listingSchema, type ListingInput } from "@/lib/listing-schema";

export async function photoUrls(paths: string[]) {
  if (!paths.length) return [] as string[];
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60);
  return (data ?? []).map((d) => d.signedUrl ?? "").filter(Boolean);
}
