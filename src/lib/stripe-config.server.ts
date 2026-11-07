/**
 * Validates the Stripe keys read from the server environment.
 * - STRIPE_SECRET_KEY: sk_test_… / sk_live_… (or restricted rk_test_… / rk_live_…)
 * - STRIPE_PUBLISHABLE_KEY (fallback VITE_STRIPE_PUBLISHABLE_KEY): pk_test_… / pk_live_…
 * Both keys must belong to the same mode (test or live).
 * Error details are for server logs only: they never include key values.
 */
export type StripeMode = "test" | "live";

export type StripeConfigErrorCode =
  | "missing_secret_key"
  | "missing_publishable_key"
  | "invalid_secret_key"
  | "invalid_publishable_key"
  | "publishable_key_is_secret"
  | "mode_mismatch"
  /** Live keys on an account Stripe has not activated yet (KYC incomplete). */
  | "live_charges_disabled";

export type StripeConfigCheck =
  | { ok: true; secretKey: string; publishableKey: string; mode: StripeMode }
  | { ok: false; code: StripeConfigErrorCode; detail: string };

/** Safe messages shown to users whatever the configuration problem is. */
export const PAYMENT_UNAVAILABLE_MESSAGE =
  "Le service de paiement est momentanément indisponible. Réessayez dans quelques minutes.";
export const BOOKING_PAYMENT_UNAVAILABLE_MESSAGE =
  "Le paiement en ligne est momentanément indisponible. Aucune demande n’a été créée et votre carte n’a pas été sollicitée. Réessayez plus tard.";

const SECRET = /^(sk|rk)_(test|live)_[A-Za-z0-9]+$/;
const PUBLISHABLE = /^pk_(test|live)_[A-Za-z0-9]+$/;

/** "sk_live_abc…" → "sk_live": enough to diagnose without leaking the key. */
const prefix = (key: string) => /^[a-z]{2}_(test|live)/.exec(key)?.[0] ?? `${key.slice(0, 3)}…`;

export function secretKeyMode(key: string): StripeMode | null {
  return (SECRET.exec(key)?.[2] as StripeMode | undefined) ?? null;
}

export function checkSecretKey(env: Record<string, string | undefined> = process.env):
  { ok: true; secretKey: string; mode: StripeMode } | { ok: false; code: StripeConfigErrorCode; detail: string } {
  const secretKey = env["STRIPE_SECRET_KEY"]?.trim() ?? "";
  if (!secretKey) return { ok: false, code: "missing_secret_key", detail: "STRIPE_SECRET_KEY n'est pas défini." };
  const mode = secretKeyMode(secretKey);
  if (!mode) {
    return {
      ok: false, code: "invalid_secret_key",
      detail: `STRIPE_SECRET_KEY doit commencer par sk_test_, sk_live_, rk_test_ ou rk_live_ (reçu : ${prefix(secretKey)}).`,
    };
  }
  return { ok: true, secretKey, mode };
}

export function checkStripeConfig(env: Record<string, string | undefined> = process.env): StripeConfigCheck {
  const secret = checkSecretKey(env);
  if (!secret.ok) return secret;

  const publishableKey = (env["STRIPE_PUBLISHABLE_KEY"] || env["VITE_STRIPE_PUBLISHABLE_KEY"] || "").trim();
  if (!publishableKey) {
    return { ok: false, code: "missing_publishable_key", detail: "STRIPE_PUBLISHABLE_KEY (ou VITE_STRIPE_PUBLISHABLE_KEY) n'est pas défini." };
  }
  // Critical: a secret key in the "publishable" slot would be sent to every browser.
  if (/^(sk|rk)_/.test(publishableKey)) {
    return {
      ok: false, code: "publishable_key_is_secret",
      detail: `La clé publique contient une clé SECRÈTE (${prefix(publishableKey)}) : elle n'est pas transmise au navigateur. Remplacez-la par la clé pk_… et régénérez cette clé secrète dans Stripe.`,
    };
  }
  const pubMode = PUBLISHABLE.exec(publishableKey)?.[1] as StripeMode | undefined;
  if (!pubMode) {
    return {
      ok: false, code: "invalid_publishable_key",
      detail: `La clé publique doit commencer par pk_test_ ou pk_live_ (reçu : ${prefix(publishableKey)}).`,
    };
  }
  if (pubMode !== secret.mode) {
    return {
      ok: false, code: "mode_mismatch",
      detail: `Clés Stripe incohérentes : clé secrète en mode ${secret.mode}, clé publique en mode ${pubMode}.`,
    };
  }
  return { ok: true, secretKey: secret.secretKey, publishableKey, mode: secret.mode };
}

/** Logs the detailed reason once per cold start and code, without key values. */
const logged = new Set<string>();
export function logStripeConfigError(check: { code: StripeConfigErrorCode; detail: string }) {
  if (logged.has(check.code)) return;
  logged.add(check.code);
  console.error(`[stripe] configuration invalide (${check.code}) : ${check.detail}`);
}

/**
 * Recognises the Stripe refusal returned when live keys are used on an account whose activation
 * (KYC: company, SIRET, IBAN, legal representative) is not complete. Stripe gives no dedicated
 * error code for this, so the message is matched; keep the pattern broad.
 */
export function isLiveChargesDisabled(status: number, error?: { message?: string; code?: string } | null): boolean {
  if (status !== 400 && status !== 403) return false;
  return /cannot currently make live charges|activate your account|account (is )?not (yet )?activated/i.test(error?.message ?? "");
}

export type StripeAccountReport = {
  /** Every condition for real (live) payments is met. */
  ready: boolean;
  mode?: StripeMode;
  errors: string[];
  warnings: string[];
  account?: {
    chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean;
    country?: string | undefined; defaultCurrency?: string | undefined; disabledReason: string | null;
    currentlyDue: string[]; pastDue: string[];
  };
};

type StripeAccountBody = {
  charges_enabled?: boolean; payouts_enabled?: boolean; details_submitted?: boolean;
  country?: string; default_currency?: string;
  requirements?: { currently_due?: string[]; past_due?: string[]; disabled_reason?: string | null };
};

/**
 * Pre-launch check (read-only: GET /v1/account, never modifies the account).
 * Live payments are ready only with consistent live keys AND an account Stripe reports as able to
 * charge and pay out with nothing past due. Test keys are always reported as "not ready".
 */
export async function checkStripeAccount(
  { env = process.env, fetchImpl = fetch }: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch } = {},
): Promise<StripeAccountReport> {
  const config = checkStripeConfig(env);
  if (!config.ok) return { ready: false, errors: [`Clés : ${config.detail}`], warnings: [] };
  const report: StripeAccountReport = { ready: false, mode: config.mode, errors: [], warnings: [] };
  if (config.mode === "test") report.errors.push("Clés en mode test : aucun paiement réel n'est possible (attendu : sk_live_ / pk_live_).");

  let res: Response;
  try {
    res = await fetchImpl("https://api.stripe.com/v1/account", {
      headers: { Authorization: `Bearer ${config.secretKey}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    report.errors.push(`API Stripe injoignable : ${(e as Error).message}`);
    return report;
  }
  const body = (await res.json().catch(() => null)) as StripeAccountBody | null;
  if (!res.ok || !body) {
    if (res.status === 401) report.errors.push("Stripe refuse STRIPE_SECRET_KEY (401) : clé révoquée ou erronée.");
    // Not ready either: the activation status is unknown, so it cannot be claimed.
    else if (res.status === 403) report.errors.push("Clé restreinte sans droit de lecture du compte : état d'activation non vérifiable. Lancez le contrôle avec la clé secrète standard.");
    else report.errors.push(`Lecture du compte impossible (HTTP ${res.status}).`);
    return report;
  }

  const req = body.requirements ?? {};
  const account = {
    chargesEnabled: body.charges_enabled === true, payoutsEnabled: body.payouts_enabled === true,
    detailsSubmitted: body.details_submitted === true,
    country: body.country, defaultCurrency: body.default_currency, disabledReason: req.disabled_reason ?? null,
    currentlyDue: req.currently_due ?? [], pastDue: req.past_due ?? [],
  };
  report.account = account;
  if (!account.detailsSubmitted) report.errors.push("Dossier d'activation non soumis (details_submitted = false).");
  if (!account.chargesEnabled) report.errors.push("Paiements désactivés par Stripe (charges_enabled = false).");
  if (!account.payoutsEnabled) report.errors.push("Virements vers l'IBAN désactivés (payouts_enabled = false).");
  if (account.disabledReason) report.errors.push(`Compte restreint par Stripe : ${account.disabledReason}.`);
  if (account.pastDue.length) report.errors.push(`Informations en retard : ${account.pastDue.join(", ")}.`);
  if (account.currentlyDue.length) report.warnings.push(`Informations demandées par Stripe : ${account.currentlyDue.join(", ")}.`);
  if (account.country && account.country !== "FR") report.warnings.push(`Pays du compte : ${account.country} (attendu : FR).`);
  if (account.defaultCurrency && account.defaultCurrency !== "eur") report.warnings.push(`Devise de règlement : ${account.defaultCurrency} (attendu : eur).`);
  report.ready = report.errors.length === 0 && config.mode === "live";
  return report;
}
