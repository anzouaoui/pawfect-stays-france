import type { Size } from "@/lib/data";

/**
 * Dog welcome rules of a listing, shared by the booking page (button state, messages) and the
 * server (createBookingWithHold), so both apply exactly the same checks.
 */
export type DogForBooking = { id: string; name: string; size: Size | string };
export type ListingDogRules = { sizes: readonly string[]; maxDogs: number };

export type DogEligibility =
  | { ok: true }
  | { ok: false; reason: "no_dog" | "too_many" | "size_not_accepted"; message: string; rejected: DogForBooking[] };

const list = (items: readonly string[]) => items.join(", ");

export function checkDogsForListing(listing: ListingDogRules, dogs: DogForBooking[]): DogEligibility {
  if (!dogs.length) {
    return { ok: false, reason: "no_dog", rejected: [], message: "Sélectionnez au moins un chien de votre passeport canin." };
  }
  const tooBig = dogs.filter((d) => !listing.sizes.includes(d.size));
  if (tooBig.length) {
    const who = tooBig.map((d) => `${d.name} (${d.size})`).join(", ");
    return {
      ok: false, reason: "size_not_accepted", rejected: tooBig,
      message: `Gabarit non accepté dans ce logement : ${who}. Gabarits acceptés : ${list(listing.sizes) || "aucun"}.`,
    };
  }
  if (dogs.length > listing.maxDogs) {
    return {
      ok: false, reason: "too_many", rejected: dogs.slice(listing.maxDogs),
      message: `Ce logement accueille ${listing.maxDogs} chien${listing.maxDogs > 1 ? "s" : ""} maximum.`,
    };
  }
  return { ok: true };
}
