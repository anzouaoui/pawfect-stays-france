import { describe, it, expect } from "vitest";
import { render } from "@react-email/render";
import {
  BOOKING_EMAILS, firstName, formatDateFr, formatEuros,
  type BookingEmailData, type BookingEmailName,
} from "@/lib/booking-emails/templates";

const SITE = "https://petinn.fr";
/** Action link sent by notifyBooking for each template. */
const LINKS: Record<BookingEmailName, string> = {
  "host-new-request": `${SITE}/hote`,
  "traveler-accepted": `${SITE}/mes-demandes`,
  "traveler-refused": `${SITE}/recherche`,
  "traveler-expired": `${SITE}/recherche`,
};
const CTA: Record<BookingEmailName, string> = {
  "host-new-request": "Voir la demande",
  "traveler-accepted": "Voir mes demandes",
  "traveler-refused": "Chercher un autre hébergement",
  "traveler-expired": "Chercher un autre hébergement",
};

const full = (name: BookingEmailName): BookingEmailData => ({
  recipientName: "Anouk",
  listingName: "Gîte des Pins",
  city: "Annecy",
  checkIn: "2026-12-01",
  checkOut: "2026-12-04",
  nights: 3,
  dogNames: "Nala, Pepper",
  total: 330.5,
  url: LINKS[name],
});

/** Normalises whitespace (incl. the narrow no-break space used by fr-FR currency) for assertions. */
const norm = (s: string) => s.replace(/[  ]/g, " ").replace(/\s+/g, " ");
/** HTML without React's text separators (<!-- -->) and without tags. */
const htmlText = (html: string) => norm(html.replace(/<!--.*?-->/g, "").replace(/<[^>]+>/g, " "));

async function renderBoth(name: BookingEmailName, data: BookingEmailData) {
  const element = BOOKING_EMAILS[name].component(data);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  return { html, text: norm(text), visible: htmlText(html) };
}

const NAMES = Object.keys(BOOKING_EMAILS) as BookingEmailName[];

describe("Booking email templates — complete data", () => {
  it("covers exactly the 4 transactional emails", () => {
    expect(NAMES.sort()).toEqual(["host-new-request", "traveler-accepted", "traveler-expired", "traveler-refused"]);
  });

  describe.each(NAMES)("%s", (name) => {
    it("injects first name, listing, city, dates, nights, dogs and total TTC (HTML and text)", async () => {
      const { text, visible } = await renderBoth(name, full(name));
      for (const out of [text, visible]) {
        expect(out).toContain("Bonjour Anouk,");
        expect(out).toContain("Gîte des Pins");
        expect(out).toContain("Annecy");
        expect(out).toContain("Du 1 décembre 2026 au 4 décembre 2026 · 3 nuits");
        expect(out).toContain("Chien(s) : Nala, Pepper");
        expect(out).toContain("Montant total TTC : 330,50 €");
      }
    });

    it("renders the direct action link with its call to action", async () => {
      const { html, text, visible } = await renderBoth(name, full(name));
      expect(html).toContain(`href="${LINKS[name]}"`);
      expect(visible).toContain(CTA[name]);
      expect(text).toContain(LINKS[name]);
    });

    it("uses the subject, preview and lang expected for a French email", async () => {
      const { html } = await renderBoth(name, full(name));
      expect(BOOKING_EMAILS[name].subject).toMatch(/PetInn/);
      expect(html).toMatch(/^<!DOCTYPE html/i);
      expect(html).toContain('lang="fr"');
    });

    it("renders without any undefined value (empty data)", async () => {
      const { html, text, visible } = await renderBoth(name, {});
      for (const out of [html, text, visible]) {
        expect(out).not.toMatch(/undefined|null|NaN|Invalid Date|\[object Object\]/);
      }
      expect(visible).toContain("Bonjour,");
      expect(visible).toContain("Votre hébergement");
      expect(visible).not.toContain("Du  au");
      expect(visible).not.toContain("Chien(s)");
      expect(visible).not.toContain("Montant");
      expect(html).not.toContain("href=");
    });

    it("hides fields that are blank, invalid or non-finite", async () => {
      const { html, visible } = await renderBoth(name, {
        recipientName: "   ", listingName: "  ", city: "", checkIn: "pas une date", checkOut: undefined,
        nights: 0, dogNames: " ", total: Number.NaN, url: "javascript:alert(1)",
      });
      expect(visible).toContain("Bonjour,");
      expect(visible).toContain("Votre hébergement");
      expect(visible).not.toMatch(/NaN|Invalid Date|0 nuit|Chien|Montant/);
      expect(html).not.toContain("javascript:");
    });

    it("escapes HTML coming from user data", async () => {
      const { html } = await renderBoth(name, { ...full(name), listingName: "<script>alert(1)</script>", dogNames: "Rex & <b>Max</b>" });
      expect(html).not.toContain("<script>alert(1)</script>");
      expect(html).toContain("&lt;script&gt;");
      expect(html).not.toContain("<b>Max</b>");
    });
  });
});

describe("Formatting helpers", () => {
  it("formats date-only values without time-zone shift and rejects invalid dates", () => {
    expect(formatDateFr("2026-12-01")).toBe("1 décembre 2026");
    expect(formatDateFr("2026-01-31")).toBe("31 janvier 2026");
    expect(formatDateFr("nope")).toBe("");
    expect(formatDateFr(undefined)).toBe("");
  });

  it("formats euros the French way", () => {
    expect(norm(formatEuros(330.5))).toBe("330,50 €");
    expect(norm(formatEuros(1234))).toBe("1 234,00 €");
    expect(formatEuros(Number.NaN)).toBe("");
    expect(formatEuros(undefined)).toBe("");
  });

  it("extracts the first name", () => {
    expect(firstName("Anouk Zouaoui")).toBe("Anouk");
    expect(firstName("  ")).toBeUndefined();
    expect(firstName(undefined)).toBeUndefined();
  });

  it("singularises one night and supports a start date alone", async () => {
    const { visible } = await renderBoth("traveler-accepted", { checkIn: "2026-12-01", nights: 1 });
    expect(visible).toContain("À partir du 1 décembre 2026 · 1 nuit");
    expect(visible).not.toContain("1 nuits");
  });
});
