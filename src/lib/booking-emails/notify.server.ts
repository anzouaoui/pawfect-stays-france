import { render } from "@react-email/render";
import { BOOKING_EMAILS, type BookingEmailName } from "./templates";
import type { Tables } from "@/integrations/supabase/types";
import { resolveSiteUrl } from "@/lib/site-url.server";

type Row = Tables<"booking_requests">;

/**
 * Sends one booking notification. Never throws: a mail failure must not block a booking action.
 * Until the sender domain is verified, emails are rendered and logged only (sending disabled).
 */
export async function notifyBooking(name: BookingEmailName, row: Row) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = name === "host-new-request" ? row.host_id : row.traveler_id;
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    const to = data.user?.email;
    if (!to) return { sent: false, reason: "no_email" as const };
    const siteUrl = await resolveSiteUrl();
    const path = name === "host-new-request" ? "/hote" : name === "traveler-accepted" ? "/mes-demandes" : "/recherche";
    const dogs = (Array.isArray(row.dogs) ? row.dogs : []) as { name?: string }[];
    const props = {
      recipientName: (data.user?.user_metadata?.["full_name"] as string | undefined) ?? undefined,
      listingName: row.listing_name, checkIn: row.check_in, checkOut: row.check_out, nights: row.nights,
      dogNames: dogs.map((d) => d.name).filter(Boolean).join(", "),
      total: Number(row.subtotal) + Number(row.fee),
      ...(siteUrl ? { url: `${siteUrl}${path}` } : {}),
    };
    const t = BOOKING_EMAILS[name];
    const html = await render(t.component(props));
    // TODO when the sender domain is connected: replace with
    // sendTemplateEmail(name, to, { templateData: props, idempotencyKey: `${name}-${row.id}` })
    console.info(`[email en attente du domaine] ${name} → ${row.id} (${html.length} caractères)`);
    return { sent: false, reason: "domain_pending" as const };
  } catch (e) {
    console.error("Notification email impossible", name, (e as Error).message);
    return { sent: false, reason: "error" as const };
  }
}
