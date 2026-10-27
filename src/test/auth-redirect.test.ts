import { describe, expect, it } from "vitest";

import { destinationForRole } from "@/lib/auth-redirect";

describe("post-verification redirect by role", () => {
  it("sends hosts to their listings", () => {
    expect(destinationForRole("hote")).toBe("/mes-annonces");
  });

  it("sends travelers to their booking requests", () => {
    expect(destinationForRole("voyageur")).toBe("/mes-demandes");
  });

  it("defaults to the traveler space when no role is known", () => {
    expect(destinationForRole(null)).toBe("/mes-demandes");
    expect(destinationForRole(undefined)).toBe("/mes-demandes");
    expect(destinationForRole("")).toBe("/mes-demandes");
  });
});
