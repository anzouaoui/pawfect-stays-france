import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function stripeConfig() {
  return import("@/lib/stripe-config.server");
}

/**
 * Calls the Stripe API with the server secret key. Throws a user-safe message on any failure.
 * `idempotencyKey` makes a retried POST (capture, cancel…) safe: Stripe replays the first result.
 */
async function stripe(path: string, body?: Record<string, string>, idempotencyKey?: string) {
  const cfg = await stripeConfig();
  const secret = cfg.checkSecretKey();
  if (!secret.ok) {
    cfg.logStripeConfigError(secret);
    throw new Error(cfg.PAYMENT_UNAVAILABLE_MESSAGE);
  }
  let res: Response;
  try {
    res = await fetch(`https://api.stripe.com/v1/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${secret.secretKey}`, "Content-Type": "application/x-www-form-urlencoded",
        ...(body && idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: body ? new URLSearchParams(body).toString() : null,
    });
  } catch (e) {
    console.error("[stripe] API injoignable", path.split("/")[0], (e as Error).message);
    throw new Error(cfg.PAYMENT_UNAVAILABLE_MESSAGE);
  }
  const json = (await res.json().catch(() => null)) as
    { id: string; status: string; client_secret: string; error?: { message?: string; code?: string; type?: string } } | null;
  if (!res.ok || !json) {
    console.error("[stripe] erreur API", res.status, json?.error?.type, json?.error?.code, json?.error?.message);
    if (res.status === 401) cfg.logStripeConfigError({ code: "invalid_secret_key", detail: "Stripe refuse STRIPE_SECRET_KEY (401) : clé révoquée ou erronée." });
    throw new Error(res.status === 401 ? cfg.PAYMENT_UNAVAILABLE_MESSAGE : "Erreur de paiement");
  }
  return json;
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export type StripeKeyResult = { key: string; mode: "test" | "live" } | { key: ""; error: string };

/**
 * Publishable key for Stripe.js. Returns `{ key: "", error }` (never throws) when the keys are
 * missing, malformed, inconsistent between test/live, or when a secret key was put in the
 * publishable slot — in which case it is never sent to the browser.
 */
export const getStripeKey = createServerFn({ method: "GET" }).handler(async (): Promise<StripeKeyResult> => {
  const cfg = await stripeConfig();
  const check = cfg.checkStripeConfig();
  if (!check.ok) {
    cfg.logStripeConfigError(check);
    return { key: "", error: cfg.PAYMENT_UNAVAILABLE_MESSAGE };
  }
  return { key: check.publishableKey, mode: check.mode };
});

const dogSchema = z.object({ id: z.string(), name: z.string(), breed: z.string(), size: z.string(), weight: z.number(), behavior: z.string() });

/** Creates the booking request (prices computed by DB trigger) and a manual-capture PaymentIntent. */
export const createBookingWithHold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    listingId: z.string().uuid(), checkIn: z.string(), checkOut: z.string(),
    dogs: z.array(dogSchema).min(1).max(10), message: z.string().max(500),
  }).parse(d))
  .handler(async ({ data, context }) => {
    // Check both keys before creating anything: no orphan request if payment cannot proceed.
    const cfg = await stripeConfig();
    const check = cfg.checkStripeConfig();
    if (!check.ok) {
      cfg.logStripeConfigError(check);
      throw new Error(cfg.BOOKING_PAYMENT_UNAVAILABLE_MESSAGE);
    }
    const { data: row, error } = await context.supabase.from("booking_requests").insert({
      listing_id: data.listingId, host_id: "00000000-0000-0000-0000-000000000000",
      check_in: data.checkIn, check_out: data.checkOut, dogs: data.dogs, message: data.message,
    }).select().single();
    if (error || !row) throw new Error(error?.message.includes("propre logement") ? "Vous ne pouvez pas réserver votre propre logement." : "Demande refusée : vérifiez les dates et vos chiens.");
    const amount = Math.round((Number(row.subtotal) + Number(row.fee)) * 100);
    const db = await admin();
    // No request may stay without its hold: undo the insert if the PaymentIntent cannot be attached.
    const rollback = async (reason: string, paymentIntentId?: string) => {
      console.error("[payments] création d'empreinte annulée", row.id, reason);
      if (paymentIntentId) await stripe(`payment_intents/${paymentIntentId}/cancel`, {}, `cancel-${row.id}`).catch(() => undefined);
      await db.from("booking_requests").delete().eq("id", row.id).eq("status", "en attente");
    };
    let pi: Awaited<ReturnType<typeof stripe>>;
    try {
      pi = await stripe("payment_intents", {
        amount: String(amount), currency: "eur", capture_method: "manual",
        "automatic_payment_methods[enabled]": "true", "automatic_payment_methods[allow_redirects]": "never",
        "metadata[booking_id]": row.id, description: `PetInn — ${row.listing_name}`,
      }, `hold-${row.id}`);
    } catch (e) {
      await rollback("PaymentIntent non créé");
      throw e;
    }
    const { error: linkError } = await db.from("booking_requests").update({ payment_intent_id: pi.id }).eq("id", row.id);
    if (linkError) {
      await rollback("PaymentIntent non rattaché", pi.id);
      throw new Error("La demande n’a pas pu être enregistrée. Votre carte n’a pas été sollicitée, réessayez.");
    }
    return { bookingId: row.id, clientSecret: pi.client_secret };
  });

/** Called after card confirmation: checks the hold with Stripe before marking it authorized. */
export const confirmHold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bookingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("booking_requests").select("*").eq("id", data.bookingId).eq("traveler_id", context.userId).single();
    if (!row?.payment_intent_id) throw new Error("Demande introuvable");
    const pi = await stripe(`payment_intents/${row.payment_intent_id}`);
    if (pi.status !== "requires_capture") throw new Error("Empreinte bancaire non confirmée");
    const { error } = await (await admin()).from("booking_requests").update({ payment_status: "autorisé" }).eq("id", row.id).eq("status", "en attente");
    if (error) throw new Error("Empreinte enregistrée mais confirmation impossible : réessayez.");
    const { notifyBooking } = await import("@/lib/booking-emails/notify.server");
    await notifyBooking("host-new-request", row);
    return { ok: true };
  });

/**
 * Host accept (capture) / refuse (release), traveler cancel (release).
 * Consistency rules:
 * - Stripe is called before the database; if Stripe fails, the request is left untouched.
 * - Each step is retry-safe: the PaymentIntent is read first, so an already captured or
 *   canceled hold is not captured/canceled twice (and POSTs carry an idempotency key).
 * - A hold that was already captured is never marked "libéré".
 * - The final update only applies if the request is still "en attente" (no race with the
 *   cron or with the other party).
 */
export const decideBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bookingId: z.string().uuid(), action: z.enum(["acceptée", "refusée", "annulée"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("booking_requests").select("*").eq("id", data.bookingId).single();
    if (!row) throw new Error("Demande introuvable");
    const isHost = row.host_id === context.userId, isTraveler = row.traveler_id === context.userId;
    if (data.action === "annulée" ? !isTraveler : !isHost) throw new Error("Action non autorisée");
    if (row.status !== "en attente") throw new Error("Demande déjà traitée");
    let payment_status = row.payment_status;
    const db = await admin();
    if (data.action === "acceptée") {
      if (row.payment_status !== "autorisé" || !row.payment_intent_id) throw new Error("Carte du voyageur non autorisée");
      const pi = await stripe(`payment_intents/${row.payment_intent_id}`);
      if (pi.status === "requires_capture") {
        try {
          await stripe(`payment_intents/${row.payment_intent_id}/capture`, {}, `capture-${row.id}`);
        } catch {
          throw new Error("Le paiement n’a pas pu être encaissé : la demande reste en attente. Réessayez dans quelques minutes.");
        }
      } else if (pi.status !== "succeeded") {
        // canceled (expired hold, 7-day limit) or never confirmed: nothing to capture.
        console.error("[payments] capture impossible", row.id, pi.status);
        throw new Error("L’empreinte bancaire du voyageur n’est plus valide : la demande ne peut pas être acceptée.");
      }
      payment_status = "encaissé";
    } else if (row.payment_intent_id) {
      const pi = await stripe(`payment_intents/${row.payment_intent_id}`);
      if (pi.status === "succeeded") {
        console.error("[payments] empreinte déjà encaissée sur une demande en attente", row.id);
        throw new Error("Le paiement de cette demande a déjà été encaissé : contactez le support PetInn.");
      }
      if (pi.status !== "canceled") await stripe(`payment_intents/${row.payment_intent_id}/cancel`, {}, `cancel-${row.id}`);
      payment_status = "libéré";
    }
    const { data: updated, error } = await db.from("booking_requests")
      .update({ status: data.action, payment_status }).eq("id", row.id).eq("status", "en attente").select("id");
    if (error) {
      console.error("[payments] statut non mis à jour après Stripe", row.id, data.action, error.message);
      throw new Error("Mise à jour impossible : réessayez, le paiement ne sera pas traité deux fois.");
    }
    if (!updated?.length) throw new Error("Demande déjà traitée");
    if (data.action === "acceptée") {
      // Lock the accepted nights on the listing so no new request can overlap them.
      try {
        const { data: listing } = await db.from("host_listings").select("blocked_dates").eq("id", row.listing_id).single();
        const nights: string[] = [];
        for (let d = new Date(row.check_in); d < new Date(row.check_out); d.setUTCDate(d.getUTCDate() + 1)) nights.push(d.toISOString().slice(0, 10));
        await db.from("host_listings").update({ blocked_dates: [...new Set([...(listing?.blocked_dates ?? []), ...nights])] }).eq("id", row.listing_id);
      } catch (e) {
        console.error("[payments] dates non bloquées après acceptation", row.id, (e as Error).message);
      }
    }
    if (data.action !== "annulée") {
      const { notifyBooking } = await import("@/lib/booking-emails/notify.server");
      await notifyBooking(data.action === "acceptée" ? "traveler-accepted" : "traveler-refused", row);
    }
    return { ok: true };
  });
