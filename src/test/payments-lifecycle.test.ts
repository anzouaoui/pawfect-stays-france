import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Lifecycle of the manual-capture card hold:
 * create (PaymentIntent) → confirm (requires_capture → autorisé) → accept (capture → encaissé)
 * or refuse / traveler cancel (cancel → libéré).
 * Server functions are invoked directly: createServerFn is replaced by a thin builder that
 * runs the input validator and the handler; Supabase and Stripe (fetch) are simulated.
 */

// --- createServerFn stub ------------------------------------------------------------
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate: (d: unknown) => unknown = (d) => d;
    const builder = {
      middleware: () => builder,
      inputValidator: (v: (d: unknown) => unknown) => { validate = v; return builder; },
      handler: (h: (ctx: { data: unknown; context: unknown }) => unknown) =>
        // async like a real server function: validation errors come back as rejections.
        async (opts: { data?: unknown; context?: unknown } = {}) => h({ data: validate(opts.data), context: opts.context }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

// --- Supabase fake: records every query, answers through `db.answer` -----------------
type Query = { table: string; op: "select" | "insert" | "update" | "delete"; values?: unknown; filters: [string, unknown][]; returning: boolean };
type Answer = { data?: unknown; error?: { message: string } | null };
const db = vi.hoisted(() => ({
  queries: [] as Query[],
  answer: (_q: Query): Answer => ({ data: null, error: null }),
}));

function client() {
  return {
    from(table: string) {
      const q: Query = { table, op: "select", filters: [], returning: false };
      const run = () => { db.queries.push(q); return Promise.resolve({ error: null, ...db.answer(q) }); };
      const b = {
        select: () => { if (q.op === "select") q.op = "select"; else q.returning = true; return b; },
        insert: (v: unknown) => { q.op = "insert"; q.values = v; return b; },
        update: (v: unknown) => { q.op = "update"; q.values = v; return b; },
        delete: () => { q.op = "delete"; return b; },
        eq: (col: string, val: unknown) => { q.filters.push([col, val]); return b; },
        in: (col: string, vals: unknown[]) => { q.filters.push([col, vals]); return b; },
        single: run,
        maybeSingle: run,
        then: (res: (v: Answer) => unknown, rej?: (e: unknown) => unknown) => run().then(res, rej),
      };
      return b;
    },
  };
}
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: client() }));
const notifyBooking = vi.hoisted(() => vi.fn());
vi.mock("@/lib/booking-emails/notify.server", () => ({ notifyBooking }));

import { createBookingWithHold, confirmHold, decideBooking } from "@/lib/payments.functions";
import { TERMS_VERSION } from "@/lib/legal";

// --- Stripe fake (fetch) -------------------------------------------------------------
type StripeCall = { method: string; path: string; idempotencyKey?: string | undefined };
const stripeCalls: StripeCall[] = [];
let stripeHandler: (c: StripeCall) => Response | Promise<Response>;
const ok = (body: object) => new Response(JSON.stringify(body), { status: 200 });
const fail = (status: number, error: object) => new Response(JSON.stringify({ error }), { status });

const BOOKING = "11111111-1111-4111-8111-111111111111";
const LISTING = "22222222-2222-4222-8222-222222222222";
const HOST = "host-a", TRAVELER = "traveler-a";
const pending = (over: Record<string, unknown> = {}) => ({
  id: BOOKING, listing_id: LISTING, host_id: HOST, traveler_id: TRAVELER, listing_name: "Gîte des Pins",
  status: "en attente", payment_status: "autorisé", payment_intent_id: "pi_123",
  check_in: "2026-12-01", check_out: "2026-12-03", nights: 2, subtotal: 300, fee: 30, dogs: [],
  ...over,
});

let row: ReturnType<typeof pending>;
const ctx = (userId: string) => ({ userId, supabase: client() });
const decide = (action: "acceptée" | "refusée" | "annulée", userId: string) =>
  (decideBooking as unknown as (o: object) => Promise<{ ok: boolean }>)({ data: { bookingId: BOOKING, action }, context: ctx(userId) });

const statusUpdates = () => db.queries.filter((q) => q.table === "booking_requests" && q.op === "update");
const stripePaths = () => stripeCalls.map((c) => `${c.method} ${c.path}`);

beforeEach(() => {
  vi.clearAllMocks();
  db.queries.length = 0;
  stripeCalls.length = 0;
  row = pending();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
  vi.stubEnv("STRIPE_PUBLISHABLE_KEY", "pk_test_123");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    const call: StripeCall = { method: init.method ?? "GET", path: url.replace("https://api.stripe.com/v1/", ""), idempotencyKey: headers["Idempotency-Key"] };
    stripeCalls.push(call);
    return stripeHandler(call);
  }));
  // Default Stripe: hold awaiting capture; capture/cancel succeed.
  stripeHandler = ({ method, path }) => {
    if (method === "GET") return ok({ id: "pi_123", status: "requires_capture" });
    if (path.endsWith("/capture")) return ok({ id: "pi_123", status: "succeeded" });
    if (path.endsWith("/cancel")) return ok({ id: "pi_123", status: "canceled" });
    return ok({ id: "pi_new", status: "requires_payment_method", client_secret: "pi_new_secret" });
  };
  // Default DB: the request exists; guarded updates match one row.
  db.answer = (q) => {
    if (q.table === "booking_requests" && q.op === "select") return { data: row };
    if (q.table === "booking_requests" && q.op === "update") return { data: q.returning ? [{ id: BOOKING }] : null };
    if (q.table === "booking_requests" && q.op === "insert") return { data: row };
    if (q.table === "host_listings" && q.op === "select") return { data: { blocked_dates: ["2026-11-20"], sizes: ["petit", "moyen", "grand"], max_dogs: 2 } };
    if (q.table === "dog_profiles" && q.op === "select") return { data: [{ id: "d1", name: "Nala", breed: "Lab", size: "grand", weight: "28", behavior: "" }] };
    return { data: null };
  };
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Host acceptance → capture", () => {
  it("captures the hold, sets acceptée / encaissé, blocks the nights and notifies the traveler", async () => {
    await expect(decide("acceptée", HOST)).resolves.toEqual({ ok: true });

    expect(stripePaths()).toEqual(["GET payment_intents/pi_123", "POST payment_intents/pi_123/capture"]);
    expect(stripeCalls[1]!.idempotencyKey).toBe(`capture-${BOOKING}`);
    const [update] = statusUpdates();
    expect(update!.values).toEqual({ status: "acceptée", payment_status: "encaissé" });
    expect(update!.filters).toEqual([["id", BOOKING], ["status", "en attente"]]);
    const listingUpdate = db.queries.find((q) => q.table === "host_listings" && q.op === "update");
    expect(listingUpdate!.values).toEqual({ blocked_dates: ["2026-11-20", "2026-12-01", "2026-12-02"] });
    expect(notifyBooking).toHaveBeenCalledWith("traveler-accepted", row);
  });

  it("leaves the request untouched when the capture fails (e.g. declined / network)", async () => {
    stripeHandler = ({ method, path }) =>
      method === "GET" ? ok({ id: "pi_123", status: "requires_capture" })
        : path.endsWith("/capture") ? fail(402, { code: "card_declined", message: "Your card was declined." })
        : ok({});
    await expect(decide("acceptée", HOST)).rejects.toThrow("n’a pas pu être encaissé");
    expect(statusUpdates()).toHaveLength(0);
    expect(db.queries.some((q) => q.table === "host_listings")).toBe(false);
    expect(notifyBooking).not.toHaveBeenCalled();
  });

  it("leaves the request untouched when Stripe is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    await expect(decide("acceptée", HOST)).rejects.toThrow("momentanément indisponible");
    expect(statusUpdates()).toHaveLength(0);
  });

  it("refuses to accept an expired / canceled hold without touching the database", async () => {
    stripeHandler = () => ok({ id: "pi_123", status: "canceled" });
    await expect(decide("acceptée", HOST)).rejects.toThrow("n’est plus valide");
    expect(stripePaths()).toEqual(["GET payment_intents/pi_123"]);
    expect(statusUpdates()).toHaveLength(0);
  });

  it("is retry-safe: an already captured hold is not captured twice after a failed DB update", async () => {
    // 1st attempt: capture OK, then the status update fails.
    db.answer = (q) => q.op === "update" && q.table === "booking_requests" ? { error: { message: "timeout" } } : q.op === "select" ? { data: row } : { data: null };
    await expect(decide("acceptée", HOST)).rejects.toThrow("ne sera pas traité deux fois");
    expect(db.queries.some((q) => q.table === "host_listings")).toBe(false);

    // 2nd attempt: Stripe now reports succeeded → no second capture, DB updated.
    stripeCalls.length = 0; db.queries.length = 0;
    stripeHandler = () => ok({ id: "pi_123", status: "succeeded" });
    db.answer = (q) => q.op === "select" && q.table === "booking_requests" ? { data: row } : q.op === "update" ? { data: [{ id: BOOKING }] } : { data: { blocked_dates: [] } };
    await expect(decide("acceptée", HOST)).resolves.toEqual({ ok: true });
    expect(stripePaths()).toEqual(["GET payment_intents/pi_123"]);
    expect(statusUpdates()[0]!.values).toEqual({ status: "acceptée", payment_status: "encaissé" });
  });

  it("requires an authorized card", async () => {
    row = pending({ payment_status: "en attente" });
    await expect(decide("acceptée", HOST)).rejects.toThrow("Carte du voyageur non autorisée");
    expect(stripeCalls).toHaveLength(0);
  });
});

describe("Host refusal → release", () => {
  it("cancels the hold and sets refusée / libéré", async () => {
    await expect(decide("refusée", HOST)).resolves.toEqual({ ok: true });
    expect(stripePaths()).toEqual(["GET payment_intents/pi_123", "POST payment_intents/pi_123/cancel"]);
    expect(stripeCalls[1]!.idempotencyKey).toBe(`cancel-${BOOKING}`);
    expect(statusUpdates()[0]!.values).toEqual({ status: "refusée", payment_status: "libéré" });
    expect(db.queries.some((q) => q.table === "host_listings")).toBe(false);
    expect(notifyBooking).toHaveBeenCalledWith("traveler-refused", row);
  });

  it("does not cancel twice when the hold is already canceled", async () => {
    stripeHandler = () => ok({ id: "pi_123", status: "canceled" });
    await decide("refusée", HOST);
    expect(stripePaths()).toEqual(["GET payment_intents/pi_123"]);
    expect(statusUpdates()[0]!.values).toEqual({ status: "refusée", payment_status: "libéré" });
  });

  it("leaves the request untouched when the cancellation fails", async () => {
    stripeHandler = ({ method }) => method === "GET" ? ok({ id: "pi_123", status: "requires_capture" }) : fail(500, { message: "boom" });
    await expect(decide("refusée", HOST)).rejects.toThrow("Erreur de paiement");
    expect(statusUpdates()).toHaveLength(0);
    expect(notifyBooking).not.toHaveBeenCalled();
  });

  it("never marks libéré a hold that was already captured", async () => {
    stripeHandler = () => ok({ id: "pi_123", status: "succeeded" });
    await expect(decide("refusée", HOST)).rejects.toThrow("déjà été encaissé");
    expect(stripePaths()).toEqual(["GET payment_intents/pi_123"]);
    expect(statusUpdates()).toHaveLength(0);
  });

  it("only the host can refuse", async () => {
    await expect(decide("refusée", TRAVELER)).rejects.toThrow("Action non autorisée");
    expect(stripeCalls).toHaveLength(0);
  });
});

describe("Traveler cancellation before the host answers → release", () => {
  it("cancels the hold, sets annulée / libéré, without emailing the traveler", async () => {
    await expect(decide("annulée", TRAVELER)).resolves.toEqual({ ok: true });
    expect(stripePaths()).toEqual(["GET payment_intents/pi_123", "POST payment_intents/pi_123/cancel"]);
    expect(statusUpdates()[0]!.values).toEqual({ status: "annulée", payment_status: "libéré" });
    expect(notifyBooking).not.toHaveBeenCalled();
  });

  it("releases even if the card was never confirmed", async () => {
    row = pending({ payment_status: "en attente" });
    stripeHandler = ({ method }) => method === "GET" ? ok({ id: "pi_123", status: "requires_payment_method" }) : ok({ id: "pi_123", status: "canceled" });
    await decide("annulée", TRAVELER);
    expect(stripePaths()).toContain("POST payment_intents/pi_123/cancel");
    expect(statusUpdates()[0]!.values).toEqual({ status: "annulée", payment_status: "libéré" });
  });

  it("loses the race cleanly if the host accepted in the meantime", async () => {
    // Stripe already captured → refuse to release; or the guarded update matches no row.
    stripeHandler = () => ok({ id: "pi_123", status: "succeeded" });
    await expect(decide("annulée", TRAVELER)).rejects.toThrow("déjà été encaissé");

    stripeHandler = ({ method }) => method === "GET" ? ok({ id: "pi_123", status: "requires_capture" }) : ok({ id: "pi_123", status: "canceled" });
    db.answer = (q) => q.op === "select" ? { data: row } : { data: [] };
    await expect(decide("annulée", TRAVELER)).rejects.toThrow("Demande déjà traitée");
  });

  it("only the traveler can cancel, and only a pending request", async () => {
    await expect(decide("annulée", HOST)).rejects.toThrow("Action non autorisée");
    row = pending({ status: "acceptée" });
    await expect(decide("annulée", TRAVELER)).rejects.toThrow("Demande déjà traitée");
    expect(stripeCalls).toHaveLength(0);
  });
});

describe("Hold creation and card confirmation", () => {
  const request = { listingId: LISTING, checkIn: "2026-12-01", checkOut: "2026-12-03", message: "", dogs: [{ id: "d1", name: "Nala", breed: "Lab", size: "grand", weight: 28, behavior: "" }] };
  const create = (consent: object = { acceptedTerms: true, termsVersion: TERMS_VERSION }) =>
    (createBookingWithHold as unknown as (o: object) => Promise<{ bookingId: string; clientSecret: string }>)({
      data: { ...request, ...consent }, context: ctx(TRAVELER),
    });
  const confirm = () => (confirmHold as unknown as (o: object) => Promise<{ ok: boolean }>)({ data: { bookingId: BOOKING }, context: ctx(TRAVELER) });

  it("creates a manual-capture PaymentIntent in EUR for subtotal + fee and links it", async () => {
    await expect(create()).resolves.toEqual({ bookingId: BOOKING, clientSecret: "pi_new_secret" });
    expect(stripePaths()).toEqual(["POST payment_intents"]);
    expect(stripeCalls[0]!.idempotencyKey).toBe(`hold-${BOOKING}`);
    const body = new URLSearchParams(((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit).body as string);
    expect(Object.fromEntries(body)).toMatchObject({ amount: "33000", currency: "eur", capture_method: "manual", "metadata[booking_id]": BOOKING });
    expect(statusUpdates()[0]!.values).toEqual({ payment_intent_id: "pi_new" });
  });

  it("records the consent (traveler, terms versions, timestamp) on the PaymentIntent", async () => {
    const before = Date.now();
    await create();
    const body = Object.fromEntries(new URLSearchParams(((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit).body as string));
    expect(body).toMatchObject({ "metadata[traveler_id]": TRAVELER, "metadata[terms_version]": TERMS_VERSION });
    expect(TERMS_VERSION).toMatch(/^cgu:\d{4}-\d{2}-\d{2};annulation:\d{4}-\d{2}-\d{2}$/);
    const at = Date.parse(body["metadata[terms_accepted_at]"]!);
    expect(at).toBeGreaterThanOrEqual(before - 1000);
    expect(at).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it("refuses to create anything without explicit consent", async () => {
    for (const consent of [{}, { acceptedTerms: false, termsVersion: TERMS_VERSION }, { acceptedTerms: "true", termsVersion: TERMS_VERSION }]) {
      await expect(create(consent)).rejects.toThrow();
    }
    expect(db.queries).toHaveLength(0);
    expect(stripeCalls).toHaveLength(0);
  });

  it("asks to accept again when the terms changed since the page was loaded", async () => {
    await expect(create({ acceptedTerms: true, termsVersion: "cgu:2026-10-27;annulation:2026-10-27" })).rejects.toThrow("mises à jour");
    expect(db.queries).toHaveLength(0);
    expect(stripeCalls).toHaveLength(0);
  });

  it("deletes the request if the PaymentIntent cannot be created (no orphan request)", async () => {
    stripeHandler = () => fail(400, { message: "bad" });
    await expect(create()).rejects.toThrow("Erreur de paiement");
    const del = db.queries.find((q) => q.op === "delete");
    expect(del!.filters).toEqual([["id", BOOKING], ["status", "en attente"]]);
  });

  it("cancels the PaymentIntent and deletes the request if linking fails", async () => {
    const base = db.answer;
    db.answer = (q) => q.op === "update" ? { error: { message: "timeout" } } : base(q);
    await expect(create()).rejects.toThrow("n’a pas pu être enregistrée");
    expect(stripePaths()).toEqual(["POST payment_intents", "POST payment_intents/pi_new/cancel"]);
    expect(db.queries.some((q) => q.op === "delete")).toBe(true);
  });

  it("marks the card autorisé only when Stripe reports requires_capture, then notifies the host", async () => {
    await expect(confirm()).resolves.toEqual({ ok: true });
    expect(statusUpdates()[0]!.values).toEqual({ payment_status: "autorisé" });
    expect(notifyBooking).toHaveBeenCalledWith("host-new-request", row);
  });

  it("keeps the request unauthorized when the card failed (expired card, 3-D Secure abandoned)", async () => {
    stripeHandler = () => ok({ id: "pi_123", status: "requires_payment_method", last_payment_error: { code: "expired_card" } });
    await expect(confirm()).rejects.toThrow("Empreinte bancaire non confirmée");
    expect(statusUpdates()).toHaveLength(0);
    expect(notifyBooking).not.toHaveBeenCalled();
  });
});
