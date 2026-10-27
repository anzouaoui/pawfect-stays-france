import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Expires pending requests older than 24 hours, releases the hold and notifies the traveler. */
export const Route = createFileRoute("/api/public/cron/expire-requests")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { notifyBooking } = await import("@/lib/booking-emails/notify.server");
        const cutoff = new Date(Date.now() - 864e5).toISOString();
        const { data: rows } = await supabaseAdmin.from("booking_requests").select("*").eq("status", "en attente").lt("created_at", cutoff).limit(100);
        let expired = 0;
        for (const row of rows ?? []) {
          if (row.payment_intent_id) {
            await fetch(`https://api.stripe.com/v1/payment_intents/${row.payment_intent_id}/cancel`, {
              method: "POST", headers: { Authorization: `Bearer ${process.env["STRIPE_SECRET_KEY"]}` },
            });
          }
          const { error } = await supabaseAdmin.from("booking_requests").update({ status: "expirée", payment_status: row.payment_intent_id ? "libéré" : row.payment_status }).eq("id", row.id).eq("status", "en attente");
          if (error) continue;
          expired++;
          if (row.payment_status === "autorisé") await notifyBooking("traveler-expired", row);
        }
        return Response.json({ expired });
      },
    },
  },
});
