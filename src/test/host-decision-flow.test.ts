import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, fireEvent, waitFor, within, cleanup } from "@testing-library/react";

/**
 * Host space end to end: the real /hote page and RequestCard, wired to the real decideBooking,
 * on an in-memory database applying the booking_requests RLS (a host reads the rows where
 * host_id = auth.uid()). Stripe is simulated with fetch, e-mails with notifyBooking.
 */

type Booking = {
  id: string; listing_id: string; host_id: string; traveler_id: string; listing_name: string;
  check_in: string; check_out: string; nights: number; dogs: unknown[]; message: string;
  subtotal: number; fee: number; status: string; payment_status: string; payment_intent_id: string | null; created_at: string;
};
const db = vi.hoisted(() => ({
  uid: null as string | null,
  bookings: [] as Booking[],
  listings: new Map<string, { blocked_dates: string[] }>(),
  stripe: new Map<string, string>(), // payment intent id → status
  loads: 0,
}));

/** Query builder over the in-memory tables. `asService` bypasses RLS (supabaseAdmin). */
function client(asService: boolean) {
  return {
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: () => undefined,
    from(table: string) {
      let op: "select" | "update" = "select";
      let values: Record<string, unknown> = {};
      let returning = false;
      const filters: [string, unknown][] = [];
      const visibleBookings = () => db.bookings.filter((b) => asService || b.host_id === db.uid || b.traveler_id === db.uid);
      const match = <T extends object>(rows: T[]) => rows.filter((r) => filters.every(([c, v]) => (r as Record<string, unknown>)[c] === v));
      const run = async () => {
        if (table === "booking_requests") {
          if (op === "select") { db.loads++; return { data: match(visibleBookings()), error: null }; }
          const hit = match(visibleBookings());
          hit.forEach((b) => Object.assign(b, values));
          return { data: returning ? hit.map((b) => ({ id: b.id })) : null, error: null };
        }
        if (table === "host_listings") {
          const id = filters.find(([c]) => c === "id")?.[1] as string;
          const l = db.listings.get(id);
          if (op === "update" && l) Object.assign(l, values);
          return { data: l ? [l] : [], error: null };
        }
        throw new Error(`unexpected table ${table}`);
      };
      const b = {
        select: () => { if (op !== "select") returning = true; return b; },
        update: (v: Record<string, unknown>) => { op = "update"; values = v; return b; },
        eq: (c: string, v: unknown) => { filters.push([c, v]); return b; },
        order: () => b,
        single: async () => { const r = await run(); const row = (r.data as unknown[])[0]; return { data: row ?? null, error: row ? null : { message: "not found" } }; },
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => run().then(res, rej),
      };
      return b;
    },
  };
}

const ui = vi.hoisted(() => ({ decide: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate: (d: unknown) => unknown = (d) => d;
    const builder = {
      middleware: () => builder,
      inputValidator: (v: (d: unknown) => unknown) => { validate = v; return builder; },
      validator: () => builder,
      handler: (h: (ctx: { data: unknown; context: unknown }) => unknown) =>
        async (opts: { data?: unknown; context?: unknown } = {}) => h({ data: validate(opts.data), context: opts.context }),
    };
    return builder;
  },
  useServerFn: () => ui.decide,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
  Link: ({ children }: { children: unknown }) => children,
}));
vi.mock("@/integrations/supabase/client", () => ({ get supabase() { return client(false); } }));
vi.mock("@/integrations/supabase/client.server", () => ({ get supabaseAdmin() { return client(true); } }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
const notifyBooking = vi.hoisted(() => vi.fn());
vi.mock("@/lib/booking-emails/notify.server", () => ({ notifyBooking }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const session = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock("@/lib/booking-requests", async (orig) => ({
  ...(await orig<typeof import("@/lib/booking-requests")>()),
  useSessionUser: () => session.user,
}));

import { Route as HostRoute } from "@/routes/hote";
import { decideBooking, ANSWER_WINDOW_MS } from "@/lib/payments.functions";

const Host = (HostRoute as unknown as { options: { component: () => null } }).options.component;
const HOST = "host-a", OTHER_HOST = "host-b", TRAVELER = "traveler-1";
const LISTING = "listing-a";
const R1 = "11111111-1111-4111-8111-111111111111";
const R2 = "22222222-2222-4222-8222-222222222222";
const R_OTHER = "33333333-3333-4333-8333-333333333333";

const booking = (over: Partial<Booking>): Booking => ({
  id: R1, listing_id: LISTING, host_id: HOST, traveler_id: TRAVELER, listing_name: "Gîte des Pins",
  check_in: "2099-07-10", check_out: "2099-07-13", nights: 3, dogs: [{ id: "d1", name: "Nala", breed: "Labrador", size: "grand", weight: 28, behavior: "Sociable" }],
  message: "Bonjour !", subtotal: 300, fee: 30, status: "en attente", payment_status: "autorisé", payment_intent_id: "pi_1",
  created_at: new Date().toISOString(), ...over,
});
/** Server call made with the identity of `uid`, as requireSupabaseAuth would provide. */
const decideAs = (uid: string, bookingId: string, action: "acceptée" | "refusée" | "annulée") =>
  (decideBooking as unknown as (o: object) => Promise<{ ok: boolean }>)({ data: { bookingId, action }, context: { userId: uid, supabase: client(false) } });
const row = (id: string) => db.bookings.find((b) => b.id === id)!;
const stripePosts = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
  .filter(([, init]) => (init as RequestInit).method === "POST").map(([url]) => String(url).replace("https://api.stripe.com/v1/", ""));

beforeEach(() => {
  vi.clearAllMocks();
  db.uid = HOST; db.loads = 0;
  db.bookings = [
    booking({ id: R1, payment_intent_id: "pi_1" }),
    booking({ id: R2, payment_intent_id: "pi_2", listing_name: "Mas du Luberon", check_in: "2099-08-01", check_out: "2099-08-03" }),
    booking({ id: R_OTHER, host_id: OTHER_HOST, listing_id: "listing-b", listing_name: "Annonce d’un autre hôte", payment_intent_id: "pi_x" }),
  ];
  db.listings = new Map([[LISTING, { blocked_dates: ["2099-06-01"] }], ["listing-b", { blocked_dates: [] }]]);
  db.stripe = new Map([["pi_1", "requires_capture"], ["pi_2", "requires_capture"], ["pi_x", "requires_capture"]]);
  session.user = { id: HOST };
  ui.decide.mockImplementation(async ({ data }: { data: { bookingId: string; action: "acceptée" | "refusée" } }) => decideAs(HOST, data.bookingId, data.action));
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
  vi.stubEnv("STRIPE_PUBLISHABLE_KEY", "pk_test_123");
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const [, id, action] = String(url).match(/payment_intents\/([^/]+)(?:\/(\w+))?/) ?? [];
    if (init.method === "POST" && action === "capture") db.stripe.set(id!, "succeeded");
    if (init.method === "POST" && action === "cancel") db.stripe.set(id!, "canceled");
    return new Response(JSON.stringify({ id, status: db.stripe.get(id!) }), { status: 200 });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Espace hôte — visibilité des demandes", () => {
  it("n’affiche que les demandes des logements de l’hôte connecté", async () => {
    render(createElement(Host));
    expect(await screen.findByText("Gîte des Pins")).toBeInTheDocument();
    expect(screen.getByText("Mas du Luberon")).toBeInTheDocument();
    expect(screen.queryByText("Annonce d’un autre hôte")).toBeNull();
    expect(screen.getByRole("button", { name: "en attente (2)" })).toBeInTheDocument();
  });

  it("montre le passeport des chiens et le montant versé à l’hôte", async () => {
    render(createElement(Host));
    const card = (await screen.findByText("Gîte des Pins")).closest("div.rounded-2xl") as HTMLElement;
    expect(within(card).getByText("🐶 Nala")).toBeInTheDocument();
    expect(within(card).getByText(/Labrador · grand · 28 kg/)).toBeInTheDocument();
    expect(card.textContent?.replace(/ | /g, " ")).toContain("Montant qui vous sera versé si vous acceptez : 300,00 €");
  });

  it("filtre sur host_id, et la RLS ne laisse lire à l’hôte que ses demandes", () => {
    const sql = readFileSync(path.resolve(__dirname, "../../drizzle/migrations/0001_booking_requests.sql"), "utf8");
    expect(sql).toMatch(/CREATE POLICY "Hosts read requests for their listings" ON public\.booking_requests\s+FOR SELECT TO authenticated USING \(auth\.uid\(\) = host_id\)/);
    expect(sql).toMatch(/CREATE POLICY "Travelers read own requests" ON public\.booking_requests\s+FOR SELECT TO authenticated USING \(auth\.uid\(\) = traveler_id\)/);
    expect(readFileSync(path.resolve(__dirname, "../lib/booking-requests.ts"), "utf8")).toContain('role === "traveler" ? "traveler_id" : "host_id"');
  });

  it("ne peut pas décider sur la demande d’un autre hôte", async () => {
    await expect(decideAs(HOST, R_OTHER, "acceptée")).rejects.toThrow("Demande introuvable"); // invisible via RLS
    db.uid = OTHER_HOST;
    await expect(decideAs(OTHER_HOST, R1, "acceptée")).rejects.toThrow("Demande introuvable");
    db.uid = TRAVELER; // the traveler sees it but is not the host
    await expect(decideAs(TRAVELER, R1, "acceptée")).rejects.toThrow("Action non autorisée");
    expect(row(R1).status).toBe("en attente");
    expect(stripePosts()).toEqual([]);
  });
});

describe("Espace hôte — « Accepter »", () => {
  it("passe la demande en acceptée, bloque les dates du logement et prévient le voyageur", async () => {
    render(createElement(Host));
    const card = (await screen.findByText("Gîte des Pins")).closest("div.rounded-2xl") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "Accepter" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Demande acceptée, paiement encaissé"));
    expect(ui.decide).toHaveBeenCalledWith({ data: { bookingId: R1, action: "acceptée" } });
    expect(row(R1)).toMatchObject({ status: "acceptée", payment_status: "encaissé" });
    expect(stripePosts()).toEqual(["payment_intents/pi_1/capture"]);
    expect(db.listings.get(LISTING)!.blocked_dates).toEqual(["2099-06-01", "2099-07-10", "2099-07-11", "2099-07-12"]);
    expect(notifyBooking).toHaveBeenCalledWith("traveler-accepted", expect.objectContaining({ id: R1, traveler_id: TRAVELER }));

    // The list is reloaded right away (no need to wait for realtime): the request moves tabs.
    await waitFor(() => expect(screen.getByRole("button", { name: "acceptée (1)" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "en attente (1)" })).toBeInTheDocument();
  });
});

describe("Espace hôte — « Refuser »", () => {
  it("passe la demande en refusée, libère l’empreinte et prévient le voyageur", async () => {
    render(createElement(Host));
    const card = (await screen.findByText("Mas du Luberon")).closest("div.rounded-2xl") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "Refuser" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Demande refusée, empreinte libérée"));
    expect(row(R2)).toMatchObject({ status: "refusée", payment_status: "libéré" });
    expect(stripePosts()).toEqual(["payment_intents/pi_2/cancel"]);
    expect(db.stripe.get("pi_2")).toBe("canceled");
    expect(db.listings.get(LISTING)!.blocked_dates).toEqual(["2099-06-01"]); // nothing blocked on refusal
    expect(notifyBooking).toHaveBeenCalledWith("traveler-refused", expect.objectContaining({ id: R2 }));
    await waitFor(() => expect(screen.getByRole("button", { name: "refusée (1)" })).toBeInTheDocument());
  });
});

describe("Demandes déjà traitées, expirées et double clic", () => {
  it.each(["acceptée", "refusée", "annulée", "expirée"])("une demande %s ne peut plus être modifiée", async (status) => {
    row(R1).status = status;
    for (const action of ["acceptée", "refusée"] as const) {
      await expect(decideAs(HOST, R1, action)).rejects.toThrow("Demande déjà traitée");
    }
    expect(row(R1).status).toBe(status);
    expect(stripePosts()).toEqual([]);
    expect(notifyBooking).not.toHaveBeenCalled();
  });

  it("n’affiche plus les boutons sur une demande traitée", async () => {
    row(R1).status = "expirée";
    row(R2).status = "refusée";
    render(createElement(Host));
    await screen.findByRole("button", { name: "expirée (1)" });
    expect(screen.queryByRole("button", { name: "Accepter" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "expirée (1)" }));
    expect(await screen.findByText("Gîte des Pins")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accepter" })).toBeNull();
  });

  it("un double clic n’envoie qu’une seule décision", async () => {
    let release!: () => void;
    ui.decide.mockImplementationOnce(async ({ data }: { data: { bookingId: string; action: "acceptée" } }) => {
      await new Promise<void>((r) => { release = r; });
      return decideAs(HOST, data.bookingId, data.action);
    });
    render(createElement(Host));
    const card = (await screen.findByText("Gîte des Pins")).closest("div.rounded-2xl") as HTMLElement;
    const accept = within(card).getByRole("button", { name: "Accepter" });
    fireEvent.click(accept);
    fireEvent.click(accept);
    expect(within(card).getByRole("button", { name: "Traitement…" })).toBeDisabled();
    expect(within(card).getByRole("button", { name: "Refuser" })).toBeDisabled();
    release();
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(ui.decide).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
    expect(stripePosts()).toEqual(["payment_intents/pi_1/capture"]);
  });

  it("deux onglets : la seconde décision, lue avant la première, échoue sans double encaissement", async () => {
    // Tab 2 loaded the request while it was still pending…
    const stale = { ...row(R1) };
    // …tab 1 accepts it first.
    await decideAs(HOST, R1, "acceptée");
    expect(row(R1)).toMatchObject({ status: "acceptée", payment_status: "encaissé" });

    // Tab 2 now decides with its stale read: the guarded update (status = 'en attente') matches nothing.
    const staleRead = client(false);
    const from = staleRead.from.bind(staleRead);
    staleRead.from = (table: string) => {
      const q = from(table);
      if (table === "booking_requests") q.single = async () => ({ data: { ...stale }, error: null });
      return q;
    };
    await expect((decideBooking as unknown as (o: object) => Promise<unknown>)({
      data: { bookingId: R1, action: "refusée" }, context: { userId: HOST, supabase: staleRead },
    })).rejects.toThrow("Le paiement de cette demande a déjà été encaissé");
    await expect((decideBooking as unknown as (o: object) => Promise<unknown>)({
      data: { bookingId: R1, action: "acceptée" }, context: { userId: HOST, supabase: staleRead },
    })).rejects.toThrow("Demande déjà traitée");

    expect(row(R1)).toMatchObject({ status: "acceptée", payment_status: "encaissé" });
    expect(stripePosts()).toEqual(["payment_intents/pi_1/capture"]); // captured once, never cancelled
    expect(notifyBooking).toHaveBeenCalledTimes(1);
  });

  it("refuse l’acceptation après le délai de 24 h, même si l’expiration automatique n’est pas encore passée", async () => {
    row(R1).created_at = new Date(Date.now() - ANSWER_WINDOW_MS - 60_000).toISOString();
    await expect(decideAs(HOST, R1, "acceptée")).rejects.toThrow("Le délai de réponse de 24 h est dépassé");
    expect(row(R1).status).toBe("en attente");
    expect(stripePosts()).toEqual([]);
    // Refusing stays possible so the hold is released.
    await decideAs(HOST, R1, "refusée");
    expect(row(R1)).toMatchObject({ status: "refusée", payment_status: "libéré" });
  });
});
