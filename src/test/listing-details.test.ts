import { describe, expect, it } from "vitest";
import { LISTINGS } from "@/lib/data";

describe("Enriched accommodation details", () => {
  it.each(LISTINGS)("provides photos, equipment and welcome rules for $name", (listing) => {
    expect(listing.photos.length).toBeGreaterThanOrEqual(3);
    expect(listing.photos[0]?.src).toBe(listing.image);
    expect(new Set(listing.photos.map((photo) => photo.src)).size).toBe(listing.photos.length);
    expect(listing.dogEquipment.map((item) => item.title)).toEqual(listing.equipment);
    expect(listing.dogRules.length).toBeGreaterThanOrEqual(6);
    expect(listing.dogRules[0]?.description).toContain(String(listing.maxDogs));
    listing.dogRules.forEach((rule) => expect(rule.description.length).toBeGreaterThan(30));
  });
});