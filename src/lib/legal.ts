/**
 * Versions of the legal documents a traveler accepts before a card hold.
 * Update the matching date whenever the text of /cgu or /annulation changes: the pages show
 * it as "Dernière mise à jour" and every booking records which versions were accepted.
 */
export const LEGAL_VERSIONS = {
  cgu: "2026-11-06",
  annulation: "2026-10-27",
} as const;

/** Stored with each card hold (Stripe PaymentIntent metadata) as proof of consent. */
export const TERMS_VERSION = `cgu:${LEGAL_VERSIONS.cgu};annulation:${LEGAL_VERSIONS.annulation}`;

/** "2026-11-06" → "6 novembre 2026". */
export function legalDate(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
