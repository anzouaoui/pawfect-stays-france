import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

type CancelResult = { released: true } | { released: false; reason: string };

/**
 * Cancels a Stripe authorization hold. A PaymentIntent that Stripe reports as already
 * canceled counts as released; any other failure leaves the hold in place.
 */
async function cancelHold(paymentIntentId: string, stripeKey: string): Promise<CancelResult> {
  try {
    const res = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}/cancel`, {
      method: "POST", headers: { Authorization: `Bearer ${stripeKey}` },
    });
    if (res.ok) return { released: true };
    const body = (await res.json().catch(() => null)) as
      { error?: { code?: string; message?: string; payment_intent?: { status?: string } } } | null;
    if (body?.error?.payment_intent?.status === "canceled") return { released: true };
    return { released: false, reason: `stripe_${res.status}${body?.error?.code ? `_${body.error.code}` : ""}` };
  } catch (e) {
    return { released: false, reason: `network: ${(e as Error).message}` };
  }
}

/**
 * Expires pending requests older than 24 hours, releases the hold and notifies the traveler.
 * A request whose hold could not be released stays "en attente" so the next run retries it,
 * instead of being marked "libéré" while the traveler's card is still blocked.
 */
export const Route = createFileRoute("/api/public/cron/expire-requests")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { notifyBooking } = await import("@/lib/booking-emails/notify.server");
        const stripeKey = process.env["STRIPE_SECRET_KEY"];
        const cutoff = new Date(Date.now() - 864e5).toISOString();
        const { data: rows, error: selectError } = await supabaseAdmin.from("booking_requests").select("*").eq("status", "en attente").lt("created_at", cutoff).limit(100);
        if (selectError) {
          console.error("[cron expire-requests] lecture impossible", selectError.message);
          return Response.json({ error: "select_failed" }, { status: 500 });
        }
        let expired = 0;
        const failed: { id: string; reason: string }[] = [];
        for (const row of rows ?? []) {
          if (row.payment_intent_id) {
            const result = stripeKey ? await cancelHold(row.payment_intent_id, stripeKey) : { released: false as const, reason: "missing_stripe_key" };
            if (!result.released) {
              console.error("[cron expire-requests] empreinte non libérée", row.id, result.reason);
              failed.push({ id: row.id, reason: result.reason });
              continue;
            }
          }
          const { error } = await supabaseAdmin.from("booking_requests").update({ status: "expirée", payment_status: row.payment_intent_id ? "libéré" : row.payment_status }).eq("id", row.id).eq("status", "en attente");
          if (error) {
            failed.push({ id: row.id, reason: "update_failed" });
            continue;
          }
          expired++;
          if (row.payment_status === "autorisé") await notifyBooking("traveler-expired", row);
        }
        return Response.json({ expired, failed: failed.length, failures: failed });
      },
    },
  },
});
