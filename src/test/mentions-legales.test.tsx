import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
}));

import { Route } from "@/routes/mentions-legales";
import { CONSUMER_MEDIATOR } from "@/lib/legal";

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

  it("identifies the publisher with the same details as the CGU (article 11)", () => {
    const { container } = render(<Page />);
    const field = (label: string) =>
      [...container.querySelectorAll("li")].find((li) => li.textContent?.startsWith(`${label} :`))?.textContent;
    expect(field("Éditeur")).toBe("Éditeur : Anouk Zouaoui");
    expect(field("Forme juridique")).toBe("Forme juridique : entrepreneur individuel (EI)");
    expect(field("Siège")).toBe("Siège : 9 Place de la Piscine, 95300 Pontoise, France");
    expect(field("Immatriculation")?.replace(/\s/g, "")).toContain("SIRET98228665000022");
    expect(field("TVA")).toBe("TVA : TVA non applicable, art. 293 B du CGI");
    expect(field("E-mail")).toBe("E-mail : contact@bricapattes.fr");
    expect(field("Téléphone")).toBe("Téléphone : communiqué sur demande à contact@bricapattes.fr");
    expect(screen.getAllByRole("link", { name: "contact@bricapattes.fr" })[0]).toHaveAttribute("href", "mailto:contact@bricapattes.fr");
    expect(container.textContent).toContain("Anouk Zouaoui, en qualité d’entrepreneur individuel");
    expect(container.textContent).not.toMatch(/Capital social|marque déposée/);
  });

  it("names the host and keeps only the facts still unknown as visible placeholders", () => {
    const { container } = render(<Page />);
    expect(container.textContent).toContain("Lovable Labs Sweden AB, Regeringsgatan 25, 111 53 Stockholm, Suède");
    expect(container.textContent).toContain("générées par intelligence artificielle");
    const placeholders = [...container.querySelectorAll("mark[data-placeholder]")].map((p) => p.textContent);
    for (const p of placeholders) expect(p).toMatch(/^\[À COMPLÉTER : .+\]$/);
    // The mediator marker goes away once CONSUMER_MEDIATOR is filled (src/lib/legal.ts).
    expect(placeholders).toHaveLength(CONSUMER_MEDIATOR ? 2 : 3);
    expect(placeholders.join(" ")).toMatch(CONSUMER_MEDIATOR ? /téléphone de l’hébergeur.*région/s : /téléphone de l’hébergeur.*région.*médiateur/s);
  });

  it("covers the GDPR essentials and links to the other legal pages", () => {
    const { container } = render(<Page />);
    const text = container.textContent ?? "";
    for (const expected of ["responsable du traitement", "Durées de conservation", "droit d’accès", "CNIL", "Stripe Payments Europe"]) {
      expect(text).toContain(expected);
    }
    const cguLinks = screen.getAllByRole("link", { name: "conditions générales d’utilisation" });
    expect(cguLinks).toHaveLength(2); // mediation section (6) + related documents (7)
    for (const link of cguLinks) expect(link).toHaveAttribute("href", "/cgu");
    expect(screen.getByRole("link", { name: "politique d’annulation" })).toHaveAttribute("href", "/annulation");
  });

  it("sets a dedicated title for search engines", () => {
    const head = Route.options.head!({} as never) as { meta: { title?: string }[] };
    expect(head.meta.find((m) => m.title)?.title).toBe("Mentions légales — PetInn");
  });
});
