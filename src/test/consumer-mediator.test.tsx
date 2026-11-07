import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CONSUMER_MEDIATOR, LEGAL_PENDING, LEGAL_VERSIONS, checkConsumerMediator, type ConsumerMediator } from "@/lib/legal";
import { MediatorDetailsList, MediatorInline } from "@/components/ConsumerMediator";

/**
 * Consumer mediator (C. conso. L. 612-1, L. 616-1). The real record stays null until the
 * publisher signs a membership. FICTITIOUS below is a test fixture only (example.org, invented
 * name): it never ships and does not stand for any real mediator.
 */
const FICTITIOUS: ConsumerMediator = {
  name: "Médiateur Fictif de Test",
  postalAddress: "1 rue de l’Exemple, 00000 Nulle-Part",
  email: "saisine@example.org",
  website: "https://mediateur.example.org",
  onlineReferral: "https://mediateur.example.org/saisir",
  membershipRef: "TEST-0000",
  membershipValidUntil: "2027-12-31",
  addedOn: "2026-11-07",
};
const opts = { cguVersion: "2026-11-07", today: "2026-11-07" };

describe("Real mediator record", () => {
  it("stays a blocking pending item while no membership is recorded", () => {
    if (CONSUMER_MEDIATOR === null) {
      expect(LEGAL_PENDING.find((p) => p.id === "mediateur")).toMatchObject({ blocking: true, pages: ["/mentions-legales", "/cgu"] });
    } else {
      expect(LEGAL_PENDING.some((p) => p.id === "mediateur")).toBe(false);
    }
  });

  it("is complete, valid, unexpired and published with an updated CGU version once filled", () => {
    if (CONSUMER_MEDIATOR === null) return;
    expect(checkConsumerMediator(CONSUMER_MEDIATOR, { cguVersion: LEGAL_VERSIONS.cgu })).toEqual([]);
  });
});

describe("checkConsumerMediator", () => {
  it("accepts a complete and consistent record", () => {
    expect(checkConsumerMediator(FICTITIOUS, opts)).toEqual([]);
    const { membershipValidUntil: _omit, ...withoutEnd } = FICTITIOUS;
    expect(checkConsumerMediator(withoutEnd, opts)).toEqual([]);
  });

  it("reports missing fields", () => {
    const issues = checkConsumerMediator({ ...FICTITIOUS, name: " ", membershipRef: "", onlineReferral: "" }, opts);
    expect(issues).toEqual(expect.arrayContaining(["name manquant", "membershipRef manquant", "onlineReferral manquant"]));
  });

  it("refuses invalid e-mail, non-https links and the closed EU ODR platform", () => {
    expect(checkConsumerMediator({ ...FICTITIOUS, email: "pas-un-mail" }, opts)).toContain("email invalide");
    expect(checkConsumerMediator({ ...FICTITIOUS, website: "http://mediateur.example.org" }, opts)).toContain("website doit être une URL https");
    expect(checkConsumerMediator({ ...FICTITIOUS, onlineReferral: "mediateur.example.org" }, opts)).toContain("onlineReferral doit être une URL https");
    expect(checkConsumerMediator({ ...FICTITIOUS, onlineReferral: "https://ec.europa.eu/consumers/odr/" }, opts).join(" ")).toContain("plateforme européenne");
  });

  it("requires the CGU version to be bumped when the mediator is added", () => {
    const issues = checkConsumerMediator(FICTITIOUS, { cguVersion: "2026-11-06", today: "2026-11-07" });
    expect(issues.join(" ")).toContain("LEGAL_VERSIONS.cgu (2026-11-06)");
  });

  it("flags an expired membership and malformed dates", () => {
    expect(checkConsumerMediator(FICTITIOUS, { ...opts, today: "2028-01-01" })).toContain("adhésion expirée le 2027-12-31");
    expect(checkConsumerMediator({ ...FICTITIOUS, addedOn: "07/11/2026" }, opts)).toContain("addedOn doit être au format AAAA-MM-JJ");
    expect(checkConsumerMediator({ ...FICTITIOUS, membershipValidUntil: "fin 2027" }, opts)).toContain("membershipValidUntil doit être au format AAAA-MM-JJ");
  });
});

describe("Mediator rendering", () => {
  it("shows one explicit placeholder per CGU line while no mediator is recorded", () => {
    const { container } = render(<MediatorDetailsList mediator={null} />);
    const marks = [...container.querySelectorAll("mark[data-placeholder='mediateur']")];
    expect(marks).toHaveLength(5);
    for (const m of marks) expect(m.textContent).toMatch(/^\[À COMPLÉTER : .+\]$/);
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("renders every CGU detail with working links once filled, without placeholders", () => {
    const { container } = render(<MediatorDetailsList mediator={FICTITIOUS} />);
    expect(container.querySelector("mark")).toBeNull();
    expect(container.textContent).toContain("Entité de médiation : Médiateur Fictif de Test");
    expect(container.textContent).toContain("Adresse postale : 1 rue de l’Exemple, 00000 Nulle-Part");
    expect(screen.getByRole("link", { name: "saisine@example.org" })).toHaveAttribute("href", "mailto:saisine@example.org");
    expect(screen.getByRole("link", { name: "https://mediateur.example.org" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "https://mediateur.example.org/saisir" })).toHaveAttribute("href", "https://mediateur.example.org/saisir");
    expect(container.textContent).not.toContain("TEST-0000"); // membership number is proof, not shown
  });

  it("renders the inline mention (mentions légales §6) in both states", () => {
    const empty = render(<MediatorInline mediator={null} />);
    expect(empty.container.querySelectorAll("mark[data-placeholder='mediateur']")).toHaveLength(1);
    empty.unmount();
    const filled = render(<MediatorInline mediator={FICTITIOUS} />);
    expect(filled.container.textContent).toBe("Médiateur Fictif de Test, 1 rue de l’Exemple, 00000 Nulle-Part (https://mediateur.example.org)");
  });
});
