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

/**
 * Consumer mediator the publisher has formally joined (Code de la consommation L. 612-1, L. 616-1).
 * Copy every field from the membership certificate and the mediator's official site; never fill
 * it before the membership is signed. Integration checklist: docs/mediation-consommation.md.
 */
export type ConsumerMediator = {
  /** Official name, as listed by the CECMC. */
  name: string;
  postalAddress: string;
  email: string;
  /** Official site (https). */
  website: string;
  /** Direct link to the online referral form (https). */
  onlineReferral: string;
  /** Membership / contract number on the certificate (proof kept by the publisher). */
  membershipRef: string;
  /** End of the membership period, if the certificate gives one (YYYY-MM-DD). */
  membershipValidUntil?: string;
  /** Day the details were added to the site (YYYY-MM-DD): LEGAL_VERSIONS.cgu must not be older. */
  addedOn: string;
};

/** null until the membership is signed and its certificate received. */
export const CONSUMER_MEDIATOR: ConsumerMediator | null = null;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const httpsUrl = (v: string) => {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Problems that must block publication of the mediator details. `today` is YYYY-MM-DD.
 * Empty list: the record is complete and consistent with the CGU version.
 */
export function checkConsumerMediator(
  m: ConsumerMediator,
  { cguVersion = LEGAL_VERSIONS.cgu, today = new Date().toISOString().slice(0, 10) }: { cguVersion?: string; today?: string } = {},
): string[] {
  const issues: string[] = [];
  for (const key of ["name", "postalAddress", "email", "website", "onlineReferral", "membershipRef", "addedOn"] as const) {
    if (!m[key]?.trim()) issues.push(`${key} manquant`);
  }
  if (m.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)) issues.push("email invalide");
  for (const key of ["website", "onlineReferral"] as const) {
    if (m[key] && !httpsUrl(m[key])) issues.push(`${key} doit être une URL https`);
  }
  // The EU ODR platform closed on 20 July 2025: it is not a mediator.
  if ([m.website, m.onlineReferral].some((u) => /ec\.europa\.eu\/consumers\/odr/i.test(u ?? ""))) {
    issues.push("la plateforme européenne RLL (fermée) n'est pas un médiateur");
  }
  if (m.addedOn && !DAY.test(m.addedOn)) issues.push("addedOn doit être au format AAAA-MM-JJ");
  else if (m.addedOn && cguVersion < m.addedOn) {
    issues.push(`LEGAL_VERSIONS.cgu (${cguVersion}) doit être mise à jour au ${m.addedOn} ou après : le texte des CGU change`);
  }
  if (m.membershipValidUntil !== undefined) {
    if (!DAY.test(m.membershipValidUntil)) issues.push("membershipValidUntil doit être au format AAAA-MM-JJ");
    else if (m.membershipValidUntil < today) issues.push(`adhésion expirée le ${m.membershipValidUntil}`);
  }
  return issues;
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
  // Pending while no membership is recorded in CONSUMER_MEDIATOR.
  ...(CONSUMER_MEDIATOR ? [] : [{
    id: "mediateur" as const, label: "Médiateur de la consommation : nom, adresse, e-mail, site, lien de saisine",
    pages: ["/mentions-legales", "/cgu"] as const, basis: "Code de la consommation art. L. 612-1 et L. 616-1", blocking: true,
  }]),
];
