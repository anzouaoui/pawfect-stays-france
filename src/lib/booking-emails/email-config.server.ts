/**
 * Email provider configuration (Resend REST API).
 * Required server secrets: RESEND_API_KEY, EMAIL_FROM. Optional: EMAIL_REPLY_TO.
 */
export type EmailConfig = { apiKey: string; from: string; fromAddress: string; replyTo?: string };

export type EmailConfigCheck =
  | { ok: true; config: EmailConfig; warnings: string[] }
  | { ok: false; missing: string[]; errors: string[]; warnings: string[] };

const ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/**
 * Domains nobody can verify in Resend (public mailboxes, the Lovable hosting domain):
 * Resend rejects any send from them, so they are treated as configuration errors.
 */
const UNVERIFIABLE_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "outlook.fr", "hotmail.com", "hotmail.fr", "live.com", "live.fr",
  "msn.com", "yahoo.com", "yahoo.fr", "icloud.com", "me.com", "orange.fr", "wanadoo.fr", "free.fr", "sfr.fr",
  "laposte.net", "gmx.com", "gmx.fr", "proton.me", "protonmail.com", "lovable.app",
]);

const senderDomain = (address: string) => address.split("@")[1]!.toLowerCase();
const isUnverifiable = (domain: string) =>
  [...UNVERIFIABLE_DOMAINS].some((d) => domain === d || domain.endsWith(`.${d}`));

/** Parses `contact@petinn.fr` or `PetInn <contact@petinn.fr>`; returns the bare address or null. */
export function parseSender(value: string): string | null {
  const v = value.trim();
  const named = /^(.+?)\s*<([^<>]+)>$/.exec(v);
  const address = named ? named[2]!.trim() : v;
  return ADDRESS.test(address) ? address : null;
}

/**
 * Reads and validates the email secrets. With `strict: true` (production readiness check),
 * the Resend sandbox sender `@resend.dev` is an error instead of a warning.
 */
export function readEmailConfig(
  env: Record<string, string | undefined> = process.env,
  { strict = false }: { strict?: boolean } = {},
): EmailConfigCheck {
  const apiKey = env["RESEND_API_KEY"]?.trim() ?? "";
  const from = env["EMAIL_FROM"]?.trim() ?? "";
  const replyTo = env["EMAIL_REPLY_TO"]?.trim() || undefined;
  const missing: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!apiKey) missing.push("RESEND_API_KEY");
  else if (!apiKey.startsWith("re_")) warnings.push("RESEND_API_KEY ne commence pas par « re_ » : vérifiez qu'il s'agit bien d'une clé Resend.");

  let fromAddress: string | null = null;
  if (!from) missing.push("EMAIL_FROM");
  else {
    fromAddress = parseSender(from);
    if (!fromAddress) errors.push(`EMAIL_FROM invalide (« ${from} ») : attendu « PetInn <contact@domaine.fr> » ou « contact@domaine.fr ».`);
    else if (senderDomain(fromAddress) === "resend.dev") {
      const msg = "EMAIL_FROM utilise resend.dev : Resend ne livre alors qu'au propriétaire du compte. Utilisez une adresse de votre domaine vérifié.";
      if (strict) errors.push(msg);
      else warnings.push(msg);
    } else if (isUnverifiable(senderDomain(fromAddress))) {
      errors.push(`EMAIL_FROM utilise ${senderDomain(fromAddress)}, un domaine qui ne peut pas être vérifié dans Resend : utilisez une adresse d'un domaine que vous possédez (voir docs/email-domain-setup.md).`);
    }
  }
  if (replyTo && !parseSender(replyTo)) errors.push(`EMAIL_REPLY_TO invalide (« ${replyTo} »).`);

  if (missing.length || errors.length || !fromAddress) return { ok: false, missing, errors, warnings };
  return { ok: true, config: { apiKey, from, fromAddress, ...(replyTo ? { replyTo } : {}) }, warnings };
}

export type EmailConnectionReport = {
  ok: boolean;
  missing: string[];
  errors: string[];
  warnings: string[];
  /** Result of the live API check, when requested. */
  api?: {
    reachable: boolean; keyValid: boolean; domainVerified?: boolean; detail: string;
    /** DNS records Resend does not see as verified yet (SPF/DKIM/MX), when the domain is pending. */
    pendingRecords?: { record: string; type: string; name: string; status: string }[];
  };
};

type ResendDomainRecord = { record?: string; type?: string; name?: string; status?: string };

/**
 * Checks that the email variables are set and, with `live: true`, that the Resend key
 * is accepted and the sender domain is verified. Never sends an email.
 */
export async function checkEmailConnection(
  { live = false, strict = false, env = process.env, fetchImpl = fetch }:
    { live?: boolean; strict?: boolean; env?: Record<string, string | undefined>; fetchImpl?: typeof fetch } = {},
): Promise<EmailConnectionReport> {
  const check = readEmailConfig(env, { strict });
  if (!check.ok) return { ok: false, missing: check.missing, errors: check.errors, warnings: check.warnings };
  const report: EmailConnectionReport = { ok: true, missing: [], errors: [], warnings: [...check.warnings] };
  if (!live) return report;

  const domain = senderDomain(check.config.fromAddress);
  const headers = { Authorization: `Bearer ${check.config.apiKey}` };
  try {
    const res = await fetchImpl("https://api.resend.com/domains", { headers, signal: AbortSignal.timeout(10_000) });
    const body = (await res.json().catch(() => null)) as
      { data?: { id?: string; name: string; status: string }[]; name?: string; message?: string } | null;
    if (res.ok) {
      const match = body?.data?.find((d) => d.name.toLowerCase() === domain);
      const domainVerified = match?.status === "verified";
      const api: NonNullable<EmailConnectionReport["api"]> = {
        reachable: true, keyValid: true, domainVerified,
        detail: match ? `Domaine ${domain} : ${match.status}` : `Domaine ${domain} absent du compte Resend`,
      };
      report.api = api;
      if (!domainVerified) {
        report.ok = false;
        report.errors.push(`Le domaine d'expédition ${domain} n'est pas vérifié dans Resend.`);
        if (match?.id) {
          // Detail per record so the missing SPF/DKIM entries are named. A failure here keeps the main error.
          const detail = await fetchImpl(`https://api.resend.com/domains/${encodeURIComponent(match.id)}`, {
            headers, signal: AbortSignal.timeout(10_000),
          }).then((r) => (r.ok ? r.json() : null)).catch(() => null) as { records?: ResendDomainRecord[] } | null;
          const pending = (detail?.records ?? [])
            .filter((r) => r.status !== "verified")
            .map((r) => ({ record: r.record ?? "?", type: r.type ?? "?", name: r.name ?? "?", status: r.status ?? "inconnu" }));
          if (pending.length) {
            api.pendingRecords = pending;
            for (const r of pending) report.errors.push(`Enregistrement ${r.record} (${r.type} ${r.name}) : ${r.status}`);
          }
        }
      }
    } else if (res.status === 401 && body?.name === "restricted_api_key") {
      // Sending-only keys cannot list domains: the key is valid but the domain cannot be checked.
      report.api = { reachable: true, keyValid: true, detail: "Clé limitée à l'envoi : statut du domaine non vérifiable" };
      report.warnings.push("Clé Resend « sending access » : impossible de vérifier le domaine depuis ce script.");
    } else {
      report.ok = false;
      report.api = { reachable: true, keyValid: false, detail: `HTTP ${res.status} ${body?.name ?? ""} ${body?.message ?? ""}`.trim() };
      report.errors.push(`Resend refuse la clé (HTTP ${res.status}).`);
    }
  } catch (e) {
    report.ok = false;
    report.api = { reachable: false, keyValid: false, detail: (e as Error).message };
    report.errors.push(`API Resend injoignable : ${(e as Error).message}`);
  }
  return report;
}
