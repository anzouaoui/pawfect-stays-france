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
  | "mode_mismatch";

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
