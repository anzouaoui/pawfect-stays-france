/**
 * Email provider configuration (Resend REST API).
 * Required server secrets: RESEND_API_KEY, EMAIL_FROM. Optional: EMAIL_REPLY_TO.
 */
export type EmailConfig = { apiKey: string; from: string; fromAddress: string; replyTo?: string };

export type EmailConfigCheck =
  | { ok: true; config: EmailConfig; warnings: string[] }
  | { ok: false; missing: string[]; errors: string[]; warnings: string[] };

const ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** Parses `contact@petinn.fr` or `PetInn <contact@petinn.fr>`; returns the bare address or null. */
export function parseSender(value: string): string | null {
  const v = value.trim();
  const named = /^(.+?)\s*<([^<>]+)>$/.exec(v);
  const address = named ? named[2]!.trim() : v;
  return ADDRESS.test(address) ? address : null;
}

export function readEmailConfig(env: Record<string, string | undefined> = process.env): EmailConfigCheck {
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
    else if (fromAddress.endsWith("@resend.dev")) warnings.push("EMAIL_FROM utilise resend.dev : Resend ne livre alors qu'au propriétaire du compte. Utilisez une adresse de votre domaine vérifié.");
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
  api?: { reachable: boolean; keyValid: boolean; domainVerified?: boolean; detail: string };
};

/**
 * Checks that the email variables are set and, with `live: true`, that the Resend key
 * is accepted and the sender domain is verified. Never sends an email.
 */
export async function checkEmailConnection(
  { live = false, env = process.env, fetchImpl = fetch }: { live?: boolean; env?: Record<string, string | undefined>; fetchImpl?: typeof fetch } = {},
): Promise<EmailConnectionReport> {
  const check = readEmailConfig(env);
  if (!check.ok) return { ok: false, missing: check.missing, errors: check.errors, warnings: check.warnings };
  const report: EmailConnectionReport = { ok: true, missing: [], errors: [], warnings: [...check.warnings] };
  if (!live) return report;

  const domain = check.config.fromAddress.split("@")[1]!.toLowerCase();
  try {
    const res = await fetchImpl("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${check.config.apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => null)) as
      { data?: { name: string; status: string }[]; name?: string; message?: string } | null;
    if (res.ok) {
      const match = body?.data?.find((d) => d.name.toLowerCase() === domain);
      const domainVerified = match?.status === "verified";
      report.api = {
        reachable: true, keyValid: true, domainVerified,
        detail: match ? `Domaine ${domain} : ${match.status}` : `Domaine ${domain} absent du compte Resend`,
      };
      if (!domainVerified) { report.ok = false; report.errors.push(`Le domaine d'expédition ${domain} n'est pas vérifié dans Resend.`); }
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
