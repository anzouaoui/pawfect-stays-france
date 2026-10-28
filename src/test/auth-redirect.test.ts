import { describe, expect, it } from "vitest";

import { destinationForRole, safePath } from "@/lib/auth-redirect";

describe("post-verification redirect by role", () => {
  it("only preserves safe internal destinations and avoids callback loops", () => {
    expect(safePath("/mes-annonces?tab=drafts")).toBe("/mes-annonces?tab=drafts");
    for (const path of ["//evil.example", "/\\evil.example", "https://evil.example", "/auth?redirect=/auth", "/x/../auth", "/\nevil.example"]) {
      expect(safePath(path)).toBe("");
    }
  });
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
