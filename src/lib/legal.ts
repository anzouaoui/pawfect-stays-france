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

export type LegalPendingId = "editeur-telephone" | "hebergeur-telephone" | "hebergeur-region" | "mediateur";

/**
 * Legal information still missing before the site opens to the public. Each entry is shown on
 * its pages as a visible marker (LegalTodo, or `data-legal-pending` for a temporary wording), and
 * a test checks that markers and this list stay in sync. Never fill a value that was not provided
 * and confirmed by the publisher. Checklist: docs/mentions-legales-checklist.md.
 */
export const LEGAL_PENDING: readonly {
  id: LegalPendingId;
  label: string;
  pages: readonly ("/mentions-legales" | "/cgu")[];
  basis: string;
  /** true: publishing without it exposes the publisher to sanctions. */
  blocking: boolean;
}[] = [
  {
    id: "editeur-telephone", label: "Numéro de téléphone de l’éditeur (remplace « communiqué sur demande »)",
    pages: ["/mentions-legales"], basis: "LCEN art. 6-III-1 a)", blocking: true,
  },
  {
    id: "hebergeur-telephone", label: "Numéro de téléphone de l’hébergeur (Lovable Labs Sweden AB)",
    pages: ["/mentions-legales"], basis: "LCEN art. 6-III-1 d)", blocking: true,
  },
  {
    id: "hebergeur-region", label: "Région d’hébergement des données (Lovable Cloud / Supabase)",
    pages: ["/mentions-legales"], basis: "RGPD art. 13 (information sur les transferts)", blocking: false,
  },
  {
    id: "mediateur", label: "Médiateur de la consommation : nom, adresse, e-mail, site, lien de saisine",
    pages: ["/mentions-legales", "/cgu"], basis: "Code de la consommation art. L. 612-1 et L. 616-1", blocking: true,
  },
];
