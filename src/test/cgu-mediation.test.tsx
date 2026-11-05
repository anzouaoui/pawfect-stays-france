import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
}));

import { Route } from "@/routes/cgu";

const Page = Route.options.component as () => React.JSX.Element;

/** Content between the "10." heading and the next h2. */
function section10(container: HTMLElement) {
  const h2s = [...container.querySelectorAll("h2")];
  const start = h2s.findIndex((h) => h.textContent?.startsWith("10."));
  const nodes: Element[] = [];
  for (let n = h2s[start]!.nextElementSibling; n && n.tagName !== "H2"; n = n.nextElementSibling) nodes.push(n);
  const wrapper = document.createElement("div");
  nodes.forEach((n) => wrapper.appendChild(n.cloneNode(true)));
  return wrapper;
}

describe("CGU — consumer mediation (art. L. 612-1 Code de la consommation)", () => {
  it("has a dedicated complaints and mediation section", () => {
    render(<Page />);
    expect(screen.getByRole("heading", { level: 2, name: "10. Réclamations, médiation et droit applicable" })).toBeInTheDocument();
    for (const name of ["Réclamation préalable", "Médiation de la consommation", "Droit applicable"]) {
      expect(screen.getByRole("heading", { level: 3, name })).toBeInTheDocument();
    }
  });

  it("states the free right to mediation and its conditions", () => {
    const s = section10(render(<Page />).container);
    const text = s.textContent ?? "";
    expect(text).toContain("le droit de recourir gratuitement à un médiateur de la consommation");
    expect(text).toContain("L. 612-1");
    expect(text).toContain("réclamation écrite");
    expect(text).toContain("délai d’un an");
    expect(within(s).getByRole("link", { name: "contact@bricapattes.fr" })).toHaveAttribute("href", "mailto:contact@bricapattes.fr");
  });

  it("lists every mediator detail, each still to complete until a mediator is signed", () => {
    const s = section10(render(<Page />).container);
    for (const label of ["Entité de médiation", "Adresse postale", "E-mail", "Site internet", "Saisine en ligne"]) {
      const li = [...s.querySelectorAll("li")].find((l) => l.textContent?.startsWith(`${label} :`));
      expect(li, label).toBeDefined();
      expect(li!.querySelector("mark[data-placeholder]")?.textContent, label).toMatch(/^\[À COMPLÉTER : .+\]$/);
    }
  });

  it("does not link to the European ODR platform, closed on 20 July 2025", () => {
    const { container } = render(<Page />);
    expect(container.innerHTML).not.toMatch(/ec\.europa\.eu\/consumers\/odr|plateforme européenne/i);
  });
});
