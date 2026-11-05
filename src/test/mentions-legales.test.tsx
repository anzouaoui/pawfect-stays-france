import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
}));

import { Route } from "@/routes/mentions-legales";

const Page = Route.options.component as () => React.JSX.Element;

describe("Mentions légales page", () => {
  it("contains every section required by the LCEN", () => {
    render(<Page />);
    expect(screen.getByRole("heading", { level: 1, name: "Mentions légales" })).toBeInTheDocument();
    for (const section of [
      "1. Éditeur du site", "2. Directeur de la publication", "3. Hébergement",
      "4. Propriété intellectuelle et marques", "5. Données personnelles (RGPD)", "6. Médiation de la consommation",
    ]) {
      expect(screen.getByRole("heading", { level: 2, name: section })).toBeInTheDocument();
    }
  });

  it("lists every publisher field, each with a visible placeholder", () => {
    const { container } = render(<Page />);
    for (const field of ["Raison sociale", "Forme juridique", "Capital social", "Siège social", "Immatriculation", "N° de TVA intracommunautaire", "E-mail", "Téléphone"]) {
      const item = [...container.querySelectorAll("li")].find((li) => li.textContent?.startsWith(`${field} :`));
      expect(item, field).toBeDefined();
      expect(item!.querySelector("[data-placeholder]"), field).not.toBeNull();
    }
    const placeholders = container.querySelectorAll("mark[data-placeholder]");
    expect(placeholders.length).toBeGreaterThan(10);
    for (const p of placeholders) expect(p.textContent).toMatch(/^\[À COMPLÉTER : .+\]$/);
  });

  it("covers the GDPR essentials and links to the other legal pages", () => {
    const { container } = render(<Page />);
    const text = container.textContent ?? "";
    for (const expected of ["responsable du traitement", "Durées de conservation", "droit d’accès", "CNIL", "Stripe Payments Europe"]) {
      expect(text).toContain(expected);
    }
    expect(screen.getByRole("link", { name: "conditions générales d’utilisation" })).toHaveAttribute("href", "/cgu");
    expect(screen.getByRole("link", { name: "politique d’annulation" })).toHaveAttribute("href", "/annulation");
  });

  it("sets a dedicated title for search engines", () => {
    const head = Route.options.head!({} as never) as { meta: { title?: string }[] };
    expect(head.meta.find((m) => m.title)?.title).toBe("Mentions légales — PetInn");
  });
});
