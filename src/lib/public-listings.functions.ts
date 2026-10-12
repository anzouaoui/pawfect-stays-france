import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { equipmentDescriptions, type DogRule, type Listing, type Size } from "@/lib/data";

const BUCKET = "listing-photos";

async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

type Row = {
  id: string; name: string; type: string; city: string; region: string; description: string;
  price_per_night: number; dog_fee_per_night: number; cleaning_fee: number; min_nights: number;
  available_from: string; available_to: string; blocked_dates: string[]; fenced_garden: boolean;
  sizes: string[]; max_dogs: number; equipment: string[]; dog_rules: unknown; photos: string[];
};

// Signed URLs point at the backend's public address so browsers can load them.
function publicStorageUrl(signed: string) {
  const pub = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined)?.replace(/\/+$/, "");
  const srv = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
  return pub && srv && signed.startsWith(srv) ? pub + signed.slice(srv.length) : signed;
}

async function toListings(rows: Row[]): Promise<Listing[]> {
  const sb = await publicClient();
  const all = rows.flatMap((r) => r.photos);
  const urls = new Map<string, string>();
  if (all.length) {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(all, 60 * 60 * 6);
    if (error) console.error("signed urls failed", error);
    data?.forEach((d) => d.signedUrl && d.path && urls.set(d.path, publicStorageUrl(d.signedUrl)));
  }
  return rows.map((r) => {
    const photos = r.photos.map((p, i) => ({ src: urls.get(p) ?? "", caption: i === 0 ? "Vue de l’hébergement" : `Photo ${i + 1}` })).filter((p) => p.src);
    const sizes = r.sizes.filter((s): s is Size => ["petit", "moyen", "grand"].includes(s));
    const rules = (Array.isArray(r.dog_rules) ? r.dog_rules : []).filter((x): x is DogRule => !!x && typeof x.title === "string" && typeof x.description === "string");
    return {
      id: r.id, name: r.name, type: r.type, city: r.city, region: r.region, description: r.description,
      price: Number(r.price_per_night), rating: 0, image: photos[0]?.src ?? "", fencedGarden: r.fenced_garden,
      sizes, maxDogs: r.max_dogs, equipment: r.equipment, host: "l’hôte", photos,
      dogEquipment: r.equipment.map((title) => ({ title, description: equipmentDescriptions[title] ?? title })),
      dogRules: [
        { title: "Chiens accueillis", description: `Jusqu’à ${r.max_dogs} chien${r.max_dogs > 1 ? "s" : ""}, de gabarit ${sizes.join(", ")}. Présentez chaque chien dans votre passeport canin.` },
        ...rules,
      ],
      hosted: {
        dogFee: Number(r.dog_fee_per_night), cleaningFee: Number(r.cleaning_fee), minNights: r.min_nights,
        availableFrom: r.available_from, availableTo: r.available_to, blockedDates: r.blocked_dates,
      },
    };
  });
}

export const getPublishedListings = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const sb = await publicClient();
    const { data, error } = await sb.from("host_listings").select("*").eq("status", "publiée").order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    return { listings: await toListings(data as Row[]), error: null as string | null };
  } catch (e) {
    console.error("getPublishedListings", e);
    return { listings: [] as Listing[], error: "Annonces indisponibles" };
  }
});

export const getPublishedListing = createServerFn({ method: "GET" })
  .validator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await publicClient();
    const { data: row, error } = await sb.from("host_listings").select("*").eq("id", data.id).eq("status", "publiée").maybeSingle();
    if (error) { console.error(error); return null; }
    if (!row) return null;
    return (await toListings([row as Row]))[0] ?? null;
  });

export const publishedListingsQuery = () => queryOptions({ queryKey: ["published-listings"], queryFn: () => getPublishedListings(), staleTime: 60_000 });

/** True when a hosted listing can be booked for the given dates (inclusive check-in, exclusive check-out). */
export function isAvailable(l: Listing, from: string, to: string) {
  const h = l.hosted;
  if (!h || !from || !to) return true;
  if (from < h.availableFrom || to > h.availableTo) return false;
  return !h.blockedDates.some((d) => d >= from && d < to);
}
