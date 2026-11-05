import { describe, it, expect, vi, beforeEach } from "vitest";
import template from "../../scripts/seed-listings.example.json";

/**
 * End to end without a database: seed entries → host_listings rows (toListingRow) →
 * public loader (getPublishedListings, Supabase simulated) → search filters.
 */

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      validator: () => builder,
      handler: (h: (ctx: { data: unknown }) => unknown) => async (opts: { data?: unknown } = {}) => h({ data: opts.data }),
    };
    return builder;
  },
}));

const db = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], filters: [] as [string, unknown][], unreadable: new Set<string>() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => {
      const q = {
        select: () => q,
        eq: (col: string, val: unknown) => { db.filters.push([col, val]); return q; },
        order: () => q,
        limit: async () => ({ data: db.rows.filter((r) => r["status"] === "publiée"), error: null }),
      };
      return q;
    },
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => ({
          data: paths.map((p) => ({ path: p, signedUrl: db.unreadable.has(p) ? null : `https://cdn.test/${p}?token=x` })),
          error: null,
        }),
      }),
    },
  }),
}));

import { getPublishedListings } from "@/lib/public-listings.functions";
import { filterListings, normalizeText, PRICE_SLIDER_MAX } from "@/lib/search";
import { seedEntrySchema, toListingRow, validateSeedFile, type SeedEntry } from "@/lib/listing-seed";
import type { Listing } from "@/lib/data";

const OWNER = "11111111-1111-4111-8111-111111111111";
const TODAY = "2026-11-06";
/** Template entries as a host would fill them (example flag removed). */
const entries: SeedEntry[] = template.listings.map(({ example: _e, ...rest }) => seedEntrySchema.parse(rest));
const byName = (ls: Listing[]) => ls.map((l) => l.name.split(" — ")[0]).sort();

async function load(): Promise<Listing[]> {
  const res = await (getPublishedListings as unknown as () => Promise<{ listings: Listing[]; error: string | null }>)();
  expect(res.error).toBeNull();
  return res.listings;
}

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://db.test");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  db.filters.length = 0;
  db.unreadable.clear();
  db.rows = entries.map((e, i) => ({
    id: `00000000-0000-4000-8000-00000000000${i}`, created_at: "2026-11-01T00:00:00Z",
    ...toListingRow(e, OWNER, e.photos.map((_, j) => `${OWNER}/photo-${i}-${j}.jpg`)),
  }));
});

describe("Seed file validation", () => {
  it("accepts the 3 template listings once the example marker is removed", () => {
    const report = validateSeedFile({ listings: template.listings.map(({ example: _e, ...r }) => r) }, TODAY);
    expect(report.errors).toEqual([]);
    expect(report.entries).toHaveLength(3);
  });

  it("refuses the template as-is, so example listings are never published", () => {
    const report = validateSeedFile(template, TODAY);
    expect(report.errors).toHaveLength(3);
    expect(report.errors[0]).toContain("exemple du modèle");
  });

  it("reports invalid fields with the listing they belong to", () => {
    const bad = { ...template.listings[0], example: false, type: "Château", price_per_night: 0, photos: [], equipment: ["Jacuzzi"], sizes: [] };
    const report = validateSeedFile({ listings: [bad] }, TODAY);
    const text = report.errors.join("\n");
    expect(text).toContain("annonce 1 (Gîte des Chênes — maison avec jardin clos) › type : Type inconnu");
    for (const field of ["price_per_night", "photos", "equipment.0", "sizes"]) expect(text).toContain(`› ${field}`);
  });

  it("rejects past availability, blocked dates outside the period and duplicate names", () => {
    const base = { ...template.listings[0], example: false };
    expect(validateSeedFile({ listings: [{ ...base, available_from: "2025-01-01", available_to: "2025-06-30", blocked_dates: [] }] }, TODAY).errors[0]).toContain("déjà passées");
    expect(validateSeedFile({ listings: [{ ...base, blocked_dates: ["2030-01-01"] }] }, TODAY).errors.join()).toContain("dates bloquées");
    expect(validateSeedFile({ listings: [base, base] }, TODAY).errors.join()).toContain("nom en double");
  });

  it("builds a published host_listings row owned by the host, with uploaded photo paths", () => {
    const row = toListingRow(entries[0]!, OWNER, [`${OWNER}/a.jpg`]);
    expect(row).toMatchObject({
      owner_id: OWNER, status: "publiée", type: "Gîte", price_per_night: 95, dog_fee_per_night: 8, cleaning_fee: 45,
      fenced_garden: true, max_dogs: 2, sizes: ["petit", "moyen", "grand"], photos: [`${OWNER}/a.jpg`],
      available_from: "2026-12-01", available_to: "2027-09-30", blocked_dates: ["2026-12-24", "2026-12-25"],
    });
  });
});

describe("Public loader (getPublishedListings)", () => {
  it("returns only published listings with signed photo URLs, prices, dog rules and availability", async () => {
    db.rows.push({ ...db.rows[0]!, id: "draft", name: "Brouillon caché", status: "brouillon" });
    const listings = await load();
    expect(db.filters).toContainEqual(["status", "publiée"]);
    expect(byName(listings)).toEqual(["Camping Les Dunes", "Gîte des Chênes", "Hôtel du Lac"]);

    const gite = listings.find((l) => l.type === "Gîte")!;
    expect(gite.image).toBe(`https://cdn.test/${OWNER}/photo-0-0.jpg?token=x`);
    expect(gite.photos).toHaveLength(3);
    expect(gite).toMatchObject({ price: 95, fencedGarden: true, maxDogs: 2, city: "Sarlat-la-Canéda" });
    expect(gite.hosted).toEqual({
      dogFee: 8, cleaningFee: 45, minNights: 2, availableFrom: "2026-12-01", availableTo: "2027-09-30",
      blockedDates: ["2026-12-24", "2026-12-25"],
    });
    expect(gite.dogRules[0]!.description).toContain("Jusqu’à 2 chiens, de gabarit petit, moyen, grand");
    expect(gite.dogRules.map((r) => r.title)).toEqual(["Chiens accueillis", "Chiens seuls", "Chambres"]);
    expect(gite.dogEquipment.map((e) => e.title)).toEqual(["Gamelles", "Panier", "Serviettes", "Sacs à déjections"]);
  });

  it("drops unreadable photos instead of showing broken images", async () => {
    db.unreadable.add(`${OWNER}/photo-0-0.jpg`);
    const gite = (await load()).find((l) => l.type === "Gîte")!;
    expect(gite.photos).toHaveLength(2);
    expect(gite.image).toBe(`https://cdn.test/${OWNER}/photo-0-1.jpg?token=x`);
  });
});

describe("Search filters (/recherche)", () => {
  let listings: Listing[];
  beforeEach(async () => { listings = await load(); });

  it("shows every published listing without filters", () => {
    expect(filterListings(listings, {})).toHaveLength(3);
    expect(filterListings(listings, { maxPrice: PRICE_SLIDER_MAX })).toHaveLength(3);
  });

  it("filters by accommodation type", () => {
    expect(byName(filterListings(listings, { type: "Camping" }))).toEqual(["Camping Les Dunes"]);
    expect(filterListings(listings, { type: "Villa" })).toEqual([]);
  });

  it("filters by dog size", () => {
    expect(byName(filterListings(listings, { size: "grand" }))).toEqual(["Gîte des Chênes"]);
    expect(byName(filterListings(listings, { size: "petit" }))).toEqual(["Camping Les Dunes", "Gîte des Chênes", "Hôtel du Lac"]);
  });

  it("filters by fenced garden", () => {
    expect(byName(filterListings(listings, { fencedGarden: true }))).toEqual(["Gîte des Chênes"]);
  });

  it("combines type, size and fenced garden", () => {
    expect(filterListings(listings, { type: "Camping", fencedGarden: true })).toEqual([]);
    expect(byName(filterListings(listings, { type: "Gîte", size: "moyen", fencedGarden: true }))).toEqual(["Gîte des Chênes"]);
  });

  it("filters by equipment (all selected items required)", () => {
    expect(byName(filterListings(listings, { equipment: ["Douche pour chien"] }))).toEqual(["Camping Les Dunes"]);
    expect(byName(filterListings(listings, { equipment: ["Gamelles", "Panier"] }))).toEqual(["Gîte des Chênes", "Hôtel du Lac"]);
  });

  it("finds a city or region regardless of case and accents", () => {
    expect(byName(filterListings(listings, { q: "sarlat-la-canEDA" }))).toEqual(["Gîte des Chênes"]);
    expect(byName(filterListings(listings, { q: "haute savoie".replace(" ", "-") }))).toEqual(["Hôtel du Lac"]);
    expect(byName(filterListings(listings, { q: "chenes" }))).toEqual(["Gîte des Chênes"]);
    expect(normalizeText(" Crème Brûlée ")).toBe("creme brulee");
  });

  it("applies the price cap below the slider maximum only", () => {
    expect(byName(filterListings(listings, { maxPrice: 100 }))).toEqual(["Camping Les Dunes", "Gîte des Chênes"]);
    const pricey = { ...listings[0]!, id: "x", price: 450 };
    expect(filterListings([pricey], { maxPrice: PRICE_SLIDER_MAX })).toHaveLength(1); // was always hidden before
    expect(filterListings([pricey], { maxPrice: 290 })).toHaveLength(0);
  });

  it("respects availability periods and blocked nights", () => {
    expect(byName(filterListings(listings, { from: "2026-12-10", to: "2026-12-12" }))).toEqual(["Gîte des Chênes", "Hôtel du Lac"]);
    expect(byName(filterListings(listings, { from: "2026-12-23", to: "2026-12-26" }))).toEqual(["Hôtel du Lac"]); // Christmas blocked at the gîte
    expect(byName(filterListings(listings, { from: "2027-07-01", to: "2027-07-08" }))).toEqual(["Camping Les Dunes", "Gîte des Chênes", "Hôtel du Lac"]);
  });
});
