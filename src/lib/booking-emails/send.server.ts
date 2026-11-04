import type { EmailConfig } from "./email-config.server";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Resend deduplicates identical keys for 24 h, so a retried booking action never sends twice. */
  idempotencyKey: string;
  tags?: { name: string; value: string }[];
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; status?: number; error: string; retryable: boolean };

const RESEND_URL = "https://api.resend.com/emails";

/** Sends one email through the Resend REST API. Never throws. */
export async function sendEmail(config: EmailConfig, input: SendEmailInput, fetchImpl: typeof fetch = fetch): Promise<SendEmailResult> {
  try {
    const res = await fetchImpl(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        from: config.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
        ...(input.tags?.length ? { tags: input.tags } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => null)) as { id?: string; name?: string; message?: string } | null;
    if (res.ok && body?.id) return { ok: true, id: body.id };
    return {
      ok: false,
      status: res.status,
      error: [body?.name, body?.message].filter(Boolean).join(": ") || `HTTP ${res.status}`,
      retryable: res.status === 429 || res.status >= 500,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message, retryable: true };
  }
}
