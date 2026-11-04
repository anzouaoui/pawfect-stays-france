import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const db = vi.hoisted(() => {
  const select = { eq: vi.fn(), lt: vi.fn(), limit: vi.fn() };
  const update = { eq: vi.fn() };
  return { from: vi.fn(), select: vi.fn(), update: vi.fn(), selectChain: select, updateChain: update };
});
const notifyBooking = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: db.from } }));
vi.mock("@/lib/booking-emails/notify.server", () => ({ notifyBooking }));

import { Route } from "@/routes/api/public/cron/expire-requests";

type Handler = (ctx: { request: Request }) => Promise<Response>;
const POST = (Route.options as unknown as { server: { handlers: { POST: Handler } } }).server.handlers.POST;

const SECRET = "cron-secret-test";
const URL_ = "http://localhost/api/public/cron/expire-requests";
const call = (authorization?: string) =>
  POST({ request: new Request(URL_, { method: "POST", headers: authorization ? { authorization } : {} }) });

const hoursAgo = (h: number) => new Date(Date.now() - h * 36e5).toISOString();
const row = (over: Record<string, unknown> = {}) => ({
  id: "req-1", status: "en attente", payment_status: "autorisé", payment_intent_id: "pi_123",
  created_at: hoursAgo(30), traveler_id: "traveler-a", host_id: "host-a", ...over,
});

const fetchMock = vi.fn();
const updateErrors: (object | null)[] = [];

function seed(rows: ReturnType<typeof row>[]) {
  db.selectChain.limit.mockResolvedValue({ data: rows, error: null });
}

beforeEach(() => {
  vi.resetAllMocks();
  updateErrors.length = 0;
  vi.stubEnv("LOVABLE_CRON_SECRET", SECRET);
  vi.stubEnv("LOVABLE_CRON_SECRET_PREVIOUS", "");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

  db.from.mockReturnValue({ select: db.select, update: db.update });
  db.select.mockReturnValue(db.selectChain);
  db.selectChain.eq.mockReturnValue(db.selectChain);
  db.selectChain.lt.mockReturnValue(db.selectChain);
  db.update.mockReturnValue(db.updateChain);
  // .update(...).eq("id").eq("status") → second eq resolves the query
  let eqCalls = 0;
  db.updateChain.eq.mockImplementation(() => {
    eqCalls++;
    if (eqCalls % 2 === 1) return db.updateChain;
    return Promise.resolve({ error: updateErrors.shift() ?? null });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Cron /api/public/cron/expire-requests — authentication", () => {
  it("rejects a call without Authorization header (401) and touches nothing", async () => {
    const res = await call();
    expect(res.status).toBe(401);
    expect(db.from).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid Bearer secret (401)", async () => {
    const res = await call("Bearer wrong-secret");
    expect(res.status).toBe(401);
    expect(db.from).not.toHaveBeenCalled();
  });

  it("rejects a malformed scheme (401)", async () => {
    expect((await call(SECRET)).status).toBe(401);
    expect((await call(`Basic ${SECRET}`)).status).toBe(401);
  });

  it("returns 500 when LOVABLE_CRON_SECRET is not configured", async () => {
    vi.stubEnv("LOVABLE_CRON_SECRET", "");
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(500);
    expect(db.from).not.toHaveBeenCalled();
  });

  it("accepts the previous secret during a rotation", async () => {
    vi.stubEnv("LOVABLE_CRON_SECRET", "new-secret");
    vi.stubEnv("LOVABLE_CRON_SECRET_PREVIOUS", SECRET);
    seed([]);
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
  });
});

describe("Cron /api/public/cron/expire-requests — authorized run", () => {
  it("selects only pending requests older than 24h", async () => {
    seed([]);
    const before = Date.now();
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ expired: 0, failed: 0 });
    expect(db.from).toHaveBeenCalledWith("booking_requests");
    expect(db.selectChain.eq).toHaveBeenCalledWith("status", "en attente");
    const [col, cutoff] = db.selectChain.lt.mock.calls[0]!;
    expect(col).toBe("created_at");
    const cutoffMs = new Date(cutoff as string).getTime();
    expect(Math.abs(before - 864e5 - cutoffMs)).toBeLessThan(5_000);
    expect(db.selectChain.limit).toHaveBeenCalledWith(100);
  });

  it("cancels the Stripe hold, marks the request expirée / libéré and notifies the traveler", async () => {
    const r = row();
    seed([r]);
    const res = await call(`Bearer ${SECRET}`);
    expect(await res.json()).toMatchObject({ expired: 1, failed: 0 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.stripe.com/v1/payment_intents/pi_123/cancel");
    expect(init).toMatchObject({ method: "POST", headers: { Authorization: "Bearer sk_test_dummy" } });

    expect(db.update).toHaveBeenCalledWith({ status: "expirée", payment_status: "libéré" });
    // Guarded update: only rows still pending are expired (no race with a host acceptance)
    expect(db.updateChain.eq.mock.calls).toEqual([["id", "req-1"], ["status", "en attente"]]);
    expect(notifyBooking).toHaveBeenCalledWith("traveler-expired", r);
  });

  it("expires a request without payment intent without calling Stripe or changing payment_status", async () => {
    seed([row({ id: "req-2", payment_intent_id: null, payment_status: "aucun" })]);
    const res = await call(`Bearer ${SECRET}`);
    expect(await res.json()).toMatchObject({ expired: 1, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.update).toHaveBeenCalledWith({ status: "expirée", payment_status: "aucun" });
    expect(notifyBooking).not.toHaveBeenCalled();
  });

  it("processes several requests and skips the ones whose update fails", async () => {
    seed([row({ id: "a", payment_intent_id: "pi_a" }), row({ id: "b", payment_intent_id: "pi_b" })]);
    updateErrors.push({ message: "conflict" }, null);
    const res = await call(`Bearer ${SECRET}`);
    expect(await res.json()).toMatchObject({ expired: 1, failed: 1, failures: [{ id: "a", reason: "update_failed" }] });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "https://api.stripe.com/v1/payment_intents/pi_a/cancel",
      "https://api.stripe.com/v1/payment_intents/pi_b/cancel",
    ]);
    expect(notifyBooking).toHaveBeenCalledTimes(1);
    expect(notifyBooking.mock.calls[0]![1]).toMatchObject({ id: "b" });
  });
});

describe("Cron /api/public/cron/expire-requests — Stripe and database failures", () => {
  const stripeError = (status: number, error: object) =>
    new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });

  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

  it("leaves the request pending (retried next run) when Stripe refuses the cancellation", async () => {
    seed([row()]);
    fetchMock.mockResolvedValue(stripeError(400, {
      code: "payment_intent_unexpected_state", payment_intent: { status: "succeeded" },
    }));
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      expired: 0, failed: 1, failures: [{ id: "req-1", reason: "stripe_400_payment_intent_unexpected_state" }],
    });
    expect(db.update).not.toHaveBeenCalled();
    expect(notifyBooking).not.toHaveBeenCalled();
  });

  it("does not mark libéré on a Stripe outage or network error", async () => {
    seed([row({ id: "a", payment_intent_id: "pi_a" }), row({ id: "b", payment_intent_id: "pi_b" })]);
    fetchMock
      .mockResolvedValueOnce(new Response("Bad gateway", { status: 502 }))
      .mockRejectedValueOnce(new Error("ECONNRESET"));
    const res = await call(`Bearer ${SECRET}`);
    expect(await res.json()).toMatchObject({
      expired: 0, failed: 2, failures: [{ id: "a", reason: "stripe_502" }, { id: "b", reason: "network: ECONNRESET" }],
    });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("treats a PaymentIntent already canceled on Stripe as released", async () => {
    seed([row()]);
    fetchMock.mockResolvedValue(stripeError(400, {
      code: "payment_intent_unexpected_state", payment_intent: { status: "canceled" },
    }));
    const res = await call(`Bearer ${SECRET}`);
    expect(await res.json()).toMatchObject({ expired: 1, failed: 0 });
    expect(db.update).toHaveBeenCalledWith({ status: "expirée", payment_status: "libéré" });
  });

  it("skips held requests without calling Stripe when STRIPE_SECRET_KEY is missing, still expiring the others", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    seed([row({ id: "held" }), row({ id: "free", payment_intent_id: null, payment_status: "aucun" })]);
    const res = await call(`Bearer ${SECRET}`);
    expect(await res.json()).toMatchObject({
      expired: 1, failed: 1, failures: [{ id: "held", reason: "missing_stripe_key" }],
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.updateChain.eq).toHaveBeenCalledWith("id", "free");
  });

  it("returns 500 when the pending requests cannot be read", async () => {
    db.selectChain.limit.mockResolvedValue({ data: null, error: { message: "db down" } });
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
