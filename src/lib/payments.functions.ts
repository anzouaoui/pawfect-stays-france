import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function stripe(path: string, body?: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${process.env["STRIPE_SECRET_KEY"]}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body ? new URLSearchParams(body).toString() : null,
  });
  const json = (await res.json()) as { id: string; status: string; client_secret: string; error?: { message: string } };
  if (!res.ok) { console.error("Stripe error", json.error?.message); throw new Error("Erreur de paiement"); }
  return json;
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export const getStripeKey = createServerFn({ method: "GET" }).handler(async () => ({
  key: process.env["STRIPE_PUBLISHABLE_KEY"] ?? process.env["VITE_STRIPE_PUBLISHABLE_KEY"] ?? "",
}));

const dogSchema = z.object({ id: z.string(), name: z.string(), breed: z.string(), size: z.string(), weight: z.number(), behavior: z.string() });

/** Creates the booking request (prices computed by DB trigger) and a manual-capture PaymentIntent. */
export const createBookingWithHold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    listingId: z.string().uuid(), checkIn: z.string(), checkOut: z.string(),
    dogs: z.array(dogSchema).min(1).max(10), message: z.string().max(500),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("booking_requests").insert({
      listing_id: data.listingId, host_id: "00000000-0000-0000-0000-000000000000",
      check_in: data.checkIn, check_out: data.checkOut, dogs: data.dogs, message: data.message,
    }).select().single();
    if (error || !row) throw new Error(error?.message.includes("propre logement") ? "Vous ne pouvez pas réserver votre propre logement." : "Demande refusée : vérifiez les dates et vos chiens.");
    const amount = Math.round((Number(row.subtotal) + Number(row.fee)) * 100);
    const pi = await stripe("payment_intents", {
      amount: String(amount), currency: "eur", capture_method: "manual",
      "automatic_payment_methods[enabled]": "true", "automatic_payment_methods[allow_redirects]": "never",
      "metadata[booking_id]": row.id, description: `PetInn — ${row.listing_name}`,
    });
    await (await admin()).from("booking_requests").update({ payment_intent_id: pi.id }).eq("id", row.id);
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
    await (await admin()).from("booking_requests").update({ payment_status: "autorisé" }).eq("id", row.id);
    const { notifyBooking } = await import("@/lib/booking-emails/notify.server");
    await notifyBooking("host-new-request", row);
    return { ok: true };
  });

/** Host accept (capture) / refuse (release), traveler cancel (release). */
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
    if (data.action === "acceptée") {
      if (row.payment_status !== "autorisé" || !row.payment_intent_id) throw new Error("Carte du voyageur non autorisée");
      await stripe(`payment_intents/${row.payment_intent_id}/capture`, {});
      payment_status = "encaissé";
    } else if (row.payment_intent_id) {
      const pi = await stripe(`payment_intents/${row.payment_intent_id}`);
      if (pi.status !== "canceled" && pi.status !== "succeeded") await stripe(`payment_intents/${row.payment_intent_id}/cancel`, {});
      payment_status = "libéré";
    }
    const { error } = await (await admin()).from("booking_requests").update({ status: data.action, payment_status }).eq("id", row.id);
    if (error) throw new Error("Mise à jour impossible");
    if (data.action !== "annulée") {
      const { notifyBooking } = await import("@/lib/booking-emails/notify.server");
      await notifyBooking(data.action === "acceptée" ? "traveler-accepted" : "traveler-refused", row);
    }
    return { ok: true };
  });
