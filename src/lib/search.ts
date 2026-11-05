import type { Listing, Size } from "@/lib/data";
import { isAvailable } from "@/lib/public-listings.functions";

/** Upper bound of the price slider: at this value the price filter is off. */
export const PRICE_SLIDER_MAX = 300;

export type SearchFilters = {
  q?: string;
  type?: string;
  from?: string;
  to?: string;
  fencedGarden?: boolean;
  size?: Size | "";
  equipment?: string[];
  /** Maximum price per night; PRICE_SLIDER_MAX (or undefined) means no limit. */
  maxPrice?: number;
};

/** Lower-case and strip accents so "ardeche" finds "Ardèche". */
export function normalizeText(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function matchesSearch(l: Listing, f: SearchFilters) {
  const q = normalizeText(f.q ?? "");
  return isAvailable(l, f.from ?? "", f.to ?? "")
    && (!q || normalizeText(`${l.city} ${l.region} ${l.name}`).includes(q))
    && (!f.type || l.type === f.type)
    && (!f.fencedGarden || l.fencedGarden)
    && (!f.size || l.sizes.includes(f.size))
    && (f.equipment ?? []).every((e) => l.equipment.includes(e))
    && (f.maxPrice === undefined || f.maxPrice >= PRICE_SLIDER_MAX || l.price <= f.maxPrice);
}

export function filterListings(listings: Listing[], f: SearchFilters) {
  return listings.filter((l) => matchesSearch(l, f));
}
