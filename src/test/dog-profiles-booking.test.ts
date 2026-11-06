import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Dog passport ↔ booking:
 * 1. CRUD of dog_profiles through src/lib/dog-profiles.ts against an in-memory table that
 *    applies the same row-level security as the migrations (owner_id = auth.uid()).
 * 2. The RLS policies themselves, read from the migration files.
 * 3. The listing's dog welcome rules (shared by the booking page and the server).
 * 4. createBookingWithHold refusing bookings that break those rules, using the sizes stored
 *    in the traveler's passports rather than what the browser sends.
 */

// --- In-memory dog_profiles with RLS ------------------------------------------------------
type DogRow = { id: string; owner_id: string; name: string; breed: string; size: string; weight: number; behavior: string; created_at: string };
const rls = vi.hoisted(() => ({ uid: null as string | null, rows: [] as DogRow[], seq: 0 }));

function dogTable() {
  let op: "select" | "insert" | "update" | "delete" = "select";
  let values: unknown;
  let returning = false;
  const filters: [string, unknown][] = [];
  const visible = () => rls.rows.filter((r) => r.owner_id === rls.uid); // USING (owner_id = auth.uid())
  const matching = () => visible().filter((r) => filters.every(([c, v]) => Array.isArray(v) ? v.includes(r[c as keyof DogRow]) : r[c as keyof DogRow] === v));
  const run = async () => {
    if (!rls.uid) return { data: null, error: { code: "42501", message: "permission denied" } };
    if (op === "insert") {
      const rows = values as Omit<DogRow, "id" | "created_at">[];
      if (rows.some((r) => r.owner_id !== rls.uid)) return { data: null, error: { code: "42501", message: "new row violates row-level security policy" } };
      rows.forEach((r) => rls.rows.push({ ...r, id: `dog-${++rls.seq}`, created_at: new Date(2026, 0, rls.seq).toISOString() }));
      return { data: null, error: null };
    }
    if (op === "update") {
      const hit = matching();
      if ((values as Partial<DogRow>).owner_id && (values as Partial<DogRow>).owner_id !== rls.uid) return { data: null, error: { code: "42501", message: "rls" } }; // WITH CHECK
      hit.forEach((r) => Object.assign(r, values));
      return { data: returning ? hit.map((r) => ({ id: r.id })) : null, error: null };
    }
    if (op === "delete") {
      const hit = matching();
      rls.rows = rls.rows.filter((r) => !hit.includes(r));
      return { data: returning ? hit.map((r) => ({ id: r.id })) : null, error: null };
    }
    return { data: matching().sort((a, b) => a.created_at.localeCompare(b.created_at)), error: null };
  };
  const b = {
    select: () => { if (op === "select") op = "select"; else returning = true; return b; },
    insert: (v: unknown) => { op = "insert"; values = v; return b; },
    update: (v: unknown) => { op = "update"; values = v; return b; },
    delete: () => { op = "delete"; return b; },
    eq: (c: string, v: unknown) => { filters.push([c, v]); return b; },
    in: (c: string, v: unknown[]) => { filters.push([c, v]); return b; },
    order: () => b,
    maybeSingle: async () => { const r = await run(); return { ...r, data: (r.data as unknown[] | null)?.[0] ?? null }; },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => run().then(res, rej),
  };
  return b;
}

// Listing visible to everyone (published).
const listing = vi.hoisted(() => ({ value: { sizes: ["petit", "moyen"], max_dogs: 2 } as { sizes: string[]; max_dogs: number } | null }));
function listingTable() {
  const b = { select: () => b, eq: () => b, maybeSingle: async () => ({ data: listing.value, error: null }) };
  return b;
}
const bookingInsert = vi.hoisted(() => vi.fn());
const fakeClient = {
  from: (table: string) => {
    if (table === "dog_profiles") return dogTable();
    if (table === "host_listings") return listingTable();
    if (table === "booking_requests") {
      return { insert: (v: unknown) => { bookingInsert(v); return { select: () => ({ single: async () => ({ data: null, error: { message: "stop" } }) }) }; } };
    }
    throw new Error(`unexpected table ${table}`);
  },
};
// Getters defer access: vi.mock is hoisted above the fake definitions.
vi.mock("@/integrations/supabase/client", () => ({ get supabase() { return fakeClient; } }));

// Server function plumbing (same approach as payments-lifecycle.test.ts).
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate: (d: unknown) => unknown = (d) => d;
    const builder = {
      middleware: () => builder,
      inputValidator: (v: (d: unknown) => unknown) => { validate = v; return builder; },
      handler: (h: (ctx: { data: unknown; context: unknown }) => unknown) =>
        async (opts: { data?: unknown; context?: unknown } = {}) => h({ data: validate(opts.data), context: opts.context }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ get supabaseAdmin() { return fakeClient; } }));
vi.mock("@/lib/booking-emails/notify.server", () => ({ notifyBooking: vi.fn() }));

import { deleteDogProfile, loadDogProfiles, saveDogProfiles, updateDogProfile } from "@/lib/dog-profiles";
import { checkDogsForListing } from "@/lib/booking-eligibility";
import { createBookingWithHold } from "@/lib/payments.functions";
import { TERMS_VERSION } from "@/lib/legal";

const ALICE = "traveler-alice";
const BOB = "traveler-bob";
const nala = { name: "Nala", breed: "Labrador", size: "grand" as const, weight: 28, behavior: "Sociable" };
const pixel = { name: "Pixel", breed: "Jack Russell", size: "petit" as const, weight: 7, behavior: "" };
const as = (uid: string | null) => { rls.uid = uid; };

beforeEach(() => {
  rls.uid = null; rls.rows = []; rls.seq = 0;
  listing.value = { sizes: ["petit", "moyen"], max_dogs: 2 };
  bookingInsert.mockClear();
});

describe("Passeport canin — création, modification, suppression avec isolation RLS", () => {
  it("crée un profil rattaché au voyageur connecté et le relit", async () => {
    as(ALICE);
    await saveDogProfiles(ALICE, [nala]);
    expect(rls.rows).toMatchObject([{ owner_id: ALICE, ...nala }]);
    expect(await loadDogProfiles(ALICE)).toEqual([{ id: "dog-1", ...nala }]);
  });

  it("un voyageur ne voit que ses propres chiens", async () => {
    as(ALICE); await saveDogProfiles(ALICE, [nala]);
    as(BOB); await saveDogProfiles(BOB, [pixel]);
    expect((await loadDogProfiles(BOB)).map((d) => d.name)).toEqual(["Pixel"]);
    // Even asking explicitly for Alice's dogs, Bob's session gets nothing.
    expect(await loadDogProfiles(ALICE)).toEqual([]);
    as(ALICE);
    expect((await loadDogProfiles(ALICE)).map((d) => d.name)).toEqual(["Nala"]);
  });

  it("refuse de créer un chien au nom d’un autre voyageur", async () => {
    as(BOB);
    await expect(saveDogProfiles(ALICE, [nala])).rejects.toMatchObject({ code: "42501" });
    expect(rls.rows).toEqual([]);
  });

  it("modifie un profil de son propre passeport", async () => {
    as(ALICE); await saveDogProfiles(ALICE, [nala]);
    await updateDogProfile(ALICE, "dog-1", { ...nala, weight: 30, behavior: "Sociable, a peur des chats" });
    expect(await loadDogProfiles(ALICE)).toEqual([{ id: "dog-1", ...nala, weight: 30, behavior: "Sociable, a peur des chats" }]);
  });

  it("ne peut ni modifier ni supprimer le chien d’un autre voyageur", async () => {
    as(ALICE); await saveDogProfiles(ALICE, [nala]);
    as(BOB);
    await expect(updateDogProfile(BOB, "dog-1", { ...nala, size: "petit" })).rejects.toThrow("Ce passeport n’est plus disponible.");
    await expect(updateDogProfile(ALICE, "dog-1", { ...nala, size: "petit" })).rejects.toThrow("Ce passeport n’est plus disponible.");
    await expect(deleteDogProfile(BOB, "dog-1")).rejects.toThrow("Ce passeport n’est plus disponible.");
    expect(rls.rows).toMatchObject([{ id: "dog-1", owner_id: ALICE, size: "grand" }]);
  });

  it("supprime un profil de son propre passeport", async () => {
    as(ALICE); await saveDogProfiles(ALICE, [nala, pixel]);
    await deleteDogProfile(ALICE, "dog-1");
    expect((await loadDogProfiles(ALICE)).map((d) => d.name)).toEqual(["Pixel"]);
    await expect(deleteDogProfile(ALICE, "dog-1")).rejects.toThrow("Ce passeport n’est plus disponible.");
  });

  it("refuse un profil incomplet avant tout appel à la base", async () => {
    as(ALICE);
    await expect(saveDogProfiles(ALICE, [{ ...nala, name: " " }])).rejects.toThrow("Nom requis");
    await expect(saveDogProfiles(ALICE, [{ ...nala, weight: 0 }])).rejects.toThrow("Poids requis");
    await expect(updateDogProfile(ALICE, "dog-1", { ...nala, size: "géant" as never })).rejects.toThrow();
    expect(rls.rows).toEqual([]);
  });

  it("refuse tout accès sans session", async () => {
    as(null);
    await expect(loadDogProfiles(ALICE)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("Politiques RLS de dog_profiles (migrations)", () => {
  const sql = ["0005_create_traveler_dog_profiles.sql", "0006_restrict_dog_profiles_grants.sql"]
    .map((f) => readFileSync(path.resolve(__dirname, "../../drizzle/migrations", f), "utf8")).join("\n");

  it("active la RLS et limite chaque opération au propriétaire", () => {
    expect(sql).toMatch(/ALTER TABLE public\.dog_profiles ENABLE ROW LEVEL SECURITY/);
    for (const op of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
      const policy = sql.match(new RegExp(`ON public\\.dog_profiles FOR ${op} TO authenticated[^;]*;`))?.[0];
      expect(policy, op).toBeDefined();
      expect(policy!.match(/owner_id = auth\.uid\(\)/g)!.length, op).toBe(op === "UPDATE" ? 2 : 1);
    }
  });

  it("n’ouvre aucun accès aux visiteurs anonymes", () => {
    expect(sql).toMatch(/REVOKE ALL ON public\.dog_profiles FROM anon/);
    expect(sql).not.toMatch(/TO anon/);
  });
});

describe("Règles d’accueil du logement (page de réservation et serveur)", () => {
  const rules = { sizes: ["petit", "moyen"], maxDogs: 2 };

  it("bloque la réservation sans chien sélectionné", () => {
    expect(checkDogsForListing(rules, [])).toEqual({ ok: false, reason: "no_dog", rejected: [], message: "Sélectionnez au moins un chien de votre passeport canin." });
  });

  it("bloque un chien dont le gabarit n’est pas accepté (l.sizes.includes(d.size))", () => {
    const r = checkDogsForListing(rules, [{ id: "1", name: "Pixel", size: "petit" }, { id: "2", name: "Nala", size: "grand" }]);
    expect(r).toMatchObject({ ok: false, reason: "size_not_accepted", rejected: [{ name: "Nala" }] });
    expect(!r.ok && r.message).toBe("Gabarit non accepté dans ce logement : Nala (grand). Gabarits acceptés : petit, moyen.");
  });

  it("bloque au-delà du nombre de chiens accepté", () => {
    const three = ["a", "b", "c"].map((id) => ({ id, name: id, size: "petit" }));
    expect(checkDogsForListing(rules, three)).toMatchObject({ ok: false, reason: "too_many", message: "Ce logement accueille 2 chiens maximum." });
  });

  it("autorise des chiens conformes", () => {
    expect(checkDogsForListing(rules, [{ id: "1", name: "Pixel", size: "petit" }, { id: "2", name: "Rex", size: "moyen" }])).toEqual({ ok: true });
  });
});

describe("createBookingWithHold — refus côté serveur", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.stubEnv("STRIPE_PUBLISHABLE_KEY", "pk_test_123");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  const book = (dogs: { id: string; name: string; breed: string; size: string; weight: number; behavior: string }[]) =>
    (createBookingWithHold as unknown as (o: object) => Promise<unknown>)({
      data: {
        listingId: "22222222-2222-4222-8222-222222222222", checkIn: "2026-12-01", checkOut: "2026-12-03", message: "",
        dogs, acceptedTerms: true, termsVersion: TERMS_VERSION,
      },
      context: { userId: rls.uid, supabase: fakeClient },
    });
  const asSent = (d: DogRow) => ({ id: d.id, name: d.name, breed: d.breed, size: d.size, weight: d.weight, behavior: d.behavior });

  it("bloque une demande sans chien", async () => {
    as(ALICE);
    await expect(book([])).rejects.toThrow();
    expect(bookingInsert).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bloque un chien trop grand, même si le navigateur annonce un petit gabarit", async () => {
    as(ALICE); await saveDogProfiles(ALICE, [nala]);
    await expect(book([{ ...asSent(rls.rows[0]!), size: "petit" }])).rejects.toThrow("Gabarit non accepté dans ce logement : Nala (grand)");
    expect(bookingInsert).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bloque un chien qui n’est pas dans le passeport du voyageur", async () => {
    as(BOB); await saveDogProfiles(BOB, [pixel]);
    as(ALICE);
    await expect(book([asSent(rls.rows[0]!)])).rejects.toThrow("n’est plus dans votre passeport canin");
    expect(bookingInsert).not.toHaveBeenCalled();
  });

  it("bloque un même chien sélectionné deux fois et un dépassement du nombre de chiens", async () => {
    as(ALICE); await saveDogProfiles(ALICE, [pixel, { ...pixel, name: "Pixel 2" }, { ...pixel, name: "Pixel 3" }]);
    await expect(book([asSent(rls.rows[0]!), asSent(rls.rows[0]!)])).rejects.toThrow("plusieurs fois");
    await expect(book(rls.rows.map(asSent))).rejects.toThrow("Ce logement accueille 2 chiens maximum.");
    expect(bookingInsert).not.toHaveBeenCalled();
  });

  it("bloque un logement qui n’est plus publié", async () => {
    as(ALICE); await saveDogProfiles(ALICE, [pixel]);
    listing.value = null;
    await expect(book([asSent(rls.rows[0]!)])).rejects.toThrow("Ce logement n’est plus disponible.");
  });

  it("accepte des chiens conformes et enregistre leur passeport tel qu’en base", async () => {
    as(ALICE); await saveDogProfiles(ALICE, [pixel]);
    // The fake insert stops right after: what matters is what would be stored.
    await expect(book([{ ...asSent(rls.rows[0]!), name: "Nom modifié", behavior: "falsifié" }])).rejects.toThrow("Demande refusée");
    expect(bookingInsert).toHaveBeenCalledWith(expect.objectContaining({
      dogs: [{ id: "dog-1", name: "Pixel", breed: "Jack Russell", size: "petit", weight: 7, behavior: "" }],
    }));
  });
});
