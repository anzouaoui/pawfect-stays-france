import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getUserById = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { auth: { admin: { getUserById } } } }));
vi.mock("@/lib/site-url.server", () => ({ resolveSiteUrl: async () => "https://petinn.fr" }));

import { notifyBooking, maskEmail } from "@/lib/booking-emails/notify.server";
import { checkEmailConnection, parseSender, readEmailConfig } from "@/lib/booking-emails/email-config.server";

const row = {
  id: "req-42", host_id: "host-a", traveler_id: "traveler-a", listing_name: "Gîte des Pins",
  check_in: "2026-12-01", check_out: "2026-12-04", nights: 3, subtotal: 300, fee: 30,
  dogs: [{ name: "Nala" }], status: "en attente", payment_status: "autorisé",
} as unknown as Parameters<typeof notifyBooking>[1];

const fetchMock = vi.fn();
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("RESEND_API_KEY", "re_test_123");
  vi.stubEnv("EMAIL_FROM", "PetInn <contact@petinn.fr>");
  vi.stubEnv("EMAIL_REPLY_TO", "");
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  getUserById.mockResolvedValue({ data: { user: { email: "anouk@example.fr", user_metadata: { full_name: "Anouk" } } } });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("notifyBooking — real sending through Resend", () => {
  it("sends the rendered template from EMAIL_FROM with an idempotency key and logs the message id", async () => {
    fetchMock.mockResolvedValue(json(200, { id: "msg_abc" }));
    const result = await notifyBooking("traveler-accepted", row);

    expect(result).toEqual({ sent: true, id: "msg_abc", idempotencyKey: "traveler-accepted/req-42" });
    expect(getUserById).toHaveBeenCalledWith("traveler-a");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer re_test_123", "Idempotency-Key": "traveler-accepted/req-42" });
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      from: "PetInn <contact@petinn.fr>", to: ["anouk@example.fr"],
      subject: "Votre séjour PetInn est confirmé", tags: [{ name: "template", value: "traveler-accepted" }],
    });
    expect(body.html).toContain("Gîte des Pins");
    expect(body.html).toContain("https://petinn.fr/mes-demandes");
    expect(body.text).toContain("Bonjour Anouk");
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining("msg_abc"));
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining("an***@example.fr"));
  });

  it("emails the host for a new request", async () => {
    fetchMock.mockResolvedValue(json(200, { id: "msg_host" }));
    await notifyBooking("host-new-request", row);
    expect(getUserById).toHaveBeenCalledWith("host-a");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).html).toContain("https://petinn.fr/hote");
  });

  it("adds reply_to when EMAIL_REPLY_TO is set", async () => {
    vi.stubEnv("EMAIL_REPLY_TO", "support@petinn.fr");
    fetchMock.mockResolvedValue(json(200, { id: "msg_r" }));
    await notifyBooking("traveler-refused", row);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).reply_to).toBe("support@petinn.fr");
  });

  it("does not call the provider and reports not_configured when variables are missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const result = await notifyBooking("traveler-expired", row);
    expect(result).toEqual({ sent: false, reason: "not_configured", idempotencyKey: "traveler-expired/req-42" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("configuration incomplète"), expect.objectContaining({ missing: ["RESEND_API_KEY"] }));
  });

  it("does not retry a definitive provider error and never throws", async () => {
    fetchMock.mockResolvedValue(json(422, { name: "validation_error", message: "Invalid `from` field" }));
    const result = await notifyBooking("traveler-accepted", row);
    expect(result).toEqual({ sent: false, reason: "provider_error", idempotencyKey: "traveler-accepted/req-42" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("échec d'envoi"),
      expect.objectContaining({ status: 422, error: "validation_error: Invalid `from` field", retryable: false }),
    );
  });

  it("retries once with the same idempotency key on a transient error", async () => {
    fetchMock.mockResolvedValueOnce(json(503, { name: "internal_server_error" })).mockResolvedValueOnce(json(200, { id: "msg_retry" }));
    const result = await notifyBooking("traveler-accepted", row);
    expect(result).toMatchObject({ sent: true, id: "msg_retry" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const keys = fetchMock.mock.calls.map((c) => c[1].headers["Idempotency-Key"]);
    expect(keys).toEqual(["traveler-accepted/req-42", "traveler-accepted/req-42"]);
  });

  it("survives a network failure on both attempts", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    const result = await notifyBooking("traveler-accepted", row);
    expect(result).toMatchObject({ sent: false, reason: "provider_error" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns no_email without sending when the account has no address", async () => {
    getUserById.mockResolvedValue({ data: { user: null } });
    expect(await notifyBooking("traveler-accepted", row)).toMatchObject({ sent: false, reason: "no_email" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns error (never throws) when the user lookup crashes", async () => {
    getUserById.mockRejectedValue(new Error("db down"));
    expect(await notifyBooking("traveler-accepted", row)).toMatchObject({ sent: false, reason: "error" });
  });
});

describe("email configuration check", () => {
  it("parses named and bare senders", () => {
    expect(parseSender("PetInn <contact@petinn.fr>")).toBe("contact@petinn.fr");
    expect(parseSender("contact@petinn.fr")).toBe("contact@petinn.fr");
    expect(parseSender("PetInn")).toBeNull();
    expect(maskEmail("anouk@example.fr")).toBe("an***@example.fr");
  });

  it("lists missing and invalid variables", () => {
    expect(readEmailConfig({})).toMatchObject({ ok: false, missing: ["RESEND_API_KEY", "EMAIL_FROM"] });
    const bad = readEmailConfig({ RESEND_API_KEY: "re_x", EMAIL_FROM: "PetInn" });
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.errors[0]).toContain("EMAIL_FROM invalide");
    const warn = readEmailConfig({ RESEND_API_KEY: "abc", EMAIL_FROM: "onboarding@resend.dev" });
    expect(warn.ok && warn.warnings).toHaveLength(2);
  });

  it("offline check does not call the API", async () => {
    const report = await checkEmailConnection({ env: { RESEND_API_KEY: "re_x", EMAIL_FROM: "contact@petinn.fr" }, fetchImpl: fetchMock });
    expect(report).toMatchObject({ ok: true, missing: [], errors: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("live check confirms the key and the verified sender domain", async () => {
    fetchMock.mockResolvedValue(json(200, { data: [{ name: "petinn.fr", status: "verified" }] }));
    const env = { RESEND_API_KEY: "re_x", EMAIL_FROM: "PetInn <contact@petinn.fr>" };
    const report = await checkEmailConnection({ live: true, env, fetchImpl: fetchMock });
    expect(report).toMatchObject({ ok: true, api: { keyValid: true, domainVerified: true } });
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.resend.com/domains");
  });

  it("live check fails on an unverified domain or a rejected key", async () => {
    const env = { RESEND_API_KEY: "re_x", EMAIL_FROM: "contact@petinn.fr" };
    fetchMock.mockResolvedValueOnce(json(200, { data: [{ name: "petinn.fr", status: "pending" }] }));
    expect(await checkEmailConnection({ live: true, env, fetchImpl: fetchMock })).toMatchObject({ ok: false, api: { domainVerified: false } });
    fetchMock.mockResolvedValueOnce(json(401, { name: "validation_error", message: "API key is invalid" }));
    expect(await checkEmailConnection({ live: true, env, fetchImpl: fetchMock })).toMatchObject({ ok: false, api: { keyValid: false } });
  });

  it("live check accepts a sending-only key with a warning", async () => {
    fetchMock.mockResolvedValue(json(401, { name: "restricted_api_key", message: "This API key is restricted to only send emails" }));
    const env = { RESEND_API_KEY: "re_x", EMAIL_FROM: "contact@petinn.fr" };
    const report = await checkEmailConnection({ live: true, env, fetchImpl: fetchMock });
    expect(report.ok).toBe(true);
    expect(report.warnings[0]).toContain("sending access");
  });
});
