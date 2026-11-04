import { render } from "@react-email/render";
import { BOOKING_EMAILS, type BookingEmailName } from "./templates";
import { readEmailConfig } from "./email-config.server";
import { sendEmail, type SendEmailResult } from "./send.server";
import type { Tables } from "@/integrations/supabase/types";
import { resolveSiteUrl } from "@/lib/site-url.server";

type Row = Tables<"booking_requests">;

export type NotifyResult =
  | { sent: true; id: string; idempotencyKey: string }
  | { sent: false; reason: "no_email" | "not_configured" | "provider_error" | "error"; idempotencyKey?: string };

/** "anouk@example.fr" → "an***@example.fr": enough to debug without logging full addresses. */
export const maskEmail = (email: string) => email.replace(/^(.{0,2})[^@]*(@.*)$/, "$1***$2");

/**
 * Sends one booking notification through Resend.
 * Never throws: a mail failure must not block a booking action. Each send carries an
 * idempotency key (`<template>/<request id>`) so a retried action does not email twice.
 */
export async function notifyBooking(name: BookingEmailName, row: Row): Promise<NotifyResult> {
  const idempotencyKey = `${name}/${row.id}`;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = name === "host-new-request" ? row.host_id : row.traveler_id;
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    const to = data.user?.email;
    if (!to) {
      console.warn(`[email] ${idempotencyKey} ignoré : aucun e-mail pour l'utilisateur ${userId}`);
      return { sent: false, reason: "no_email", idempotencyKey };
    }
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

    const config = readEmailConfig();
    if (!config.ok) {
      console.error(`[email] ${idempotencyKey} non envoyé : configuration incomplète`, {
        missing: config.missing, errors: config.errors,
      });
      return { sent: false, reason: "not_configured", idempotencyKey };
    }
    for (const warning of config.warnings) console.warn(`[email] ${warning}`);

    const t = BOOKING_EMAILS[name];
    const element = t.component(props);
    const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
    const message = { to, subject: t.subject, html, text, idempotencyKey, tags: [{ name: "template", value: name }] };

    let result: SendEmailResult = await sendEmail(config.config, message);
    if (!result.ok && result.retryable) {
      // Same idempotency key: Resend will not send twice if the first attempt actually went through.
      await new Promise((r) => setTimeout(r, 500));
      result = await sendEmail(config.config, message);
    }

    if (result.ok) {
      console.info(`[email] ${idempotencyKey} envoyé à ${maskEmail(to)} (id Resend ${result.id})`);
      return { sent: true, id: result.id, idempotencyKey };
    }
    console.error(`[email] ${idempotencyKey} échec d'envoi à ${maskEmail(to)}`, {
      status: result.status, error: result.error, retryable: result.retryable,
    });
    return { sent: false, reason: "provider_error", idempotencyKey };
  } catch (e) {
    console.error(`[email] ${idempotencyKey} erreur inattendue`, (e as Error).message);
    return { sent: false, reason: "error", idempotencyKey };
  }
}
