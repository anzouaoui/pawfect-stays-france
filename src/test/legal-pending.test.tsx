import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
}));

import { Route as Mentions } from "@/routes/mentions-legales";
import { Route as Cgu } from "@/routes/cgu";
import { LEGAL_PENDING } from "@/lib/legal";

/**
 * Pre-publication inventory of the legal pages: every missing fact is visible on the page AND
 * listed in LEGAL_PENDING (src/lib/legal.ts, mirrored in docs/mentions-legales-checklist.md).
 * Filling a value means removing its marker and its LEGAL_PENDING entry together.
 */
const pages = {
  "/mentions-legales": Mentions.options.component as () => React.JSX.Element,
  "/cgu": Cgu.options.component as () => React.JSX.Element,
} as const;

function markers(path: keyof typeof pages) {
  const Page = pages[path];
  const { container, unmount } = render(<Page />);
  const todos = [...container.querySelectorAll("mark[data-placeholder]")];
  const temporary = [...container.querySelectorAll("[data-legal-pending]")];
  const result = {
    text: container.textContent ?? "",
    todoIds: todos.map((m) => m.getAttribute("data-placeholder")),
    todoTexts: todos.map((m) => m.textContent),
    ids: new Set([...todos.map((m) => m.getAttribute("data-placeholder")), ...temporary.map((m) => m.getAttribute("data-legal-pending"))]),
  };
  unmount();
  return result;
}

describe("Legal pages — pending information inventory", () => {
  for (const path of Object.keys(pages) as (keyof typeof pages)[]) {
    it(`${path}: shows exactly the facts listed as pending for this page`, () => {
      const m = markers(path);
      const expected = LEGAL_PENDING.filter((p) => p.pages.includes(path)).map((p) => p.id);
      expect([...m.ids].sort()).toEqual([...expected].sort());
    });

    it(`${path}: every placeholder is identified and explicit`, () => {
      const m = markers(path);
      const known = new Set(LEGAL_PENDING.map((p) => p.id));
      for (const id of m.todoIds) expect(known.has(id as never), String(id)).toBe(true);
      for (const t of m.todoTexts) expect(t).toMatch(/^\[À COMPLÉTER : .+\]$/);
    });
  }

  it("keeps the publisher's temporary phone wording flagged as blocking until a real number is provided", () => {
    const phone = LEGAL_PENDING.find((p) => p.id === "editeur-telephone");
    expect(phone).toMatchObject({ blocking: true, pages: ["/mentions-legales"] });
    expect(markers("/mentions-legales").text).toContain("Téléphone : communiqué sur demande");
  });

  it("documents every pending item in the pre-publication checklist", async () => {
    const { readFileSync } = await import("node:fs");
    const doc = readFileSync("docs/mentions-legales-checklist.md", "utf-8");
    for (const p of LEGAL_PENDING) expect(doc, p.id).toContain(`\`${p.id}\``);
  });
});

describe("Legal pages — publisher identity", () => {
  const digits = (s: string) => s.replace(/\D/g, "");
  /** Luhn checksum used by INSEE for SIREN/SIRET: catches a typo, does not prove the number exists. */
  const luhn = (n: string) =>
    [...n].reverse().reduce((sum, c, i) => {
      let d = Number(c) * (i % 2 ? 2 : 1);
      if (d > 9) d -= 9;
      return sum + d;
    }, 0) % 10 === 0;

  it("states the same SIRET, address and contact on /mentions-legales and in the CGU (article 11)", () => {
    const mentions = markers("/mentions-legales").text;
    const cgu = markers("/cgu").text;
    const siret = (t: string) => digits(/SIRET\s*([\d\s]+)/.exec(t)?.[1] ?? "");
    expect(siret(mentions)).toHaveLength(14);
    expect(siret(cgu)).toBe(siret(mentions));
    for (const shared of ["9 Place de la Piscine, 95300 Pontoise, France", "contact@bricapattes.fr", "Anouk Zouaoui"]) {
      expect(mentions, shared).toContain(shared);
      expect(cgu, shared).toContain(shared);
    }
  });

  it("uses a well-formed SIRET whose first 9 digits are the stated SIREN", () => {
    const text = markers("/mentions-legales").text;
    const siret = digits(/SIRET\s*([\d\s]+)/.exec(text)![1]!);
    const siren = digits(/SIREN\s*([\d\s]+)/.exec(text)![1]!);
    expect(luhn(siret)).toBe(true);
    expect(luhn(siren)).toBe(true);
    expect(siret.startsWith(siren)).toBe(true);
  });
});
