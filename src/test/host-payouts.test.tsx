import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { hostPayout, parisDay, euros } from "@/lib/payouts";
import { RequestCard } from "@/components/RequestCard";
import type { BookingRequest } from "@/lib/store";

const norm = (s: string | null | undefined) => (s ?? "").replace(/[  ]/g, " ");
const at = (iso: string) => new Date(iso);

const accepted = (over: Partial<BookingRequest> = {}): BookingRequest => ({
  id: "b1", listingId: "l1", listingName: "Gîte des Pins", checkIn: "2026-12-10", checkOut: "2026-12-13", nights: 3,
  dogIds: [], dogs: [], message: "", subtotal: 300, fee: 30, status: "acceptée", createdAt: "2026-11-01T10:00:00Z",
  paymentStatus: "encaissé", ...over,
});

describe("hostPayout — amounts", () => {
  it("owes the full subtotal to the host; the 10 % fee stays with PetInn", () => {
    const p = hostPayout(accepted({ subtotal: 287.5, fee: 29 }), at("2026-12-01T12:00:00Z"))!;
    expect(p).toMatchObject({ net: 287.5, fee: 29, total: 316.5 });
  });

  it("returns nothing for requests that are not accepted", () => {
    for (const status of ["en attente", "refusée", "annulée", "expirée"] as const) {
      expect(hostPayout(accepted({ status }))).toBeNull();
    }
  });
});

describe("hostPayout — status", () => {
  it("before arrival: to be paid after the traveler's arrival", () => {
    const p = hostPayout(accepted(), at("2026-12-09T22:30:00Z"))!; // 23:30 in Paris, day before check-in
    expect(p.status).toBe("scheduled");
    expect(p.label).toBe("À verser à l’arrivée du voyageur");
    expect(p.detail).toContain("sous 24 h après l’arrivée du 10 décembre 2026");
  });

  it("from the check-in day (Paris time): transfer in progress", () => {
    expect(hostPayout(accepted(), at("2026-12-09T23:30:00Z"))!.status).toBe("processing"); // 00:30 in Paris
    expect(hostPayout(accepted(), at("2026-12-14T10:00:00Z"))!.status).toBe("processing");
  });

  it("five days after check-in: should have been received", () => {
    const p = hostPayout(accepted(), at("2026-12-15T10:00:00Z"))!;
    expect(p.status).toBe("sent");
    expect(p.detail).toContain("Contactez PetInn");
  });

  it("flags an accepted booking whose payment is not captured", () => {
    expect(hostPayout(accepted({ paymentStatus: "autorisé" }))!.status).toBe("payment_issue");
  });

  it("treats browser-stored sample bookings as demo (no money involved)", () => {
    const { paymentStatus: _omit, ...sample } = accepted();
    expect(hostPayout(sample)!.status).toBe("demo");
  });

  it("computes the Paris day across the DST change", () => {
    expect(parisDay(at("2026-03-28T23:30:00Z"))).toBe("2026-03-29"); // UTC+1
    expect(parisDay(at("2026-07-01T22:30:00Z"))).toBe("2026-07-02"); // UTC+2
  });
});

describe("RequestCard — host view", () => {
  it("shows the net amount owed and the payout status for an accepted booking", () => {
    // Check-in far in the future → "scheduled" whatever today's date is.
    render(<RequestCard host r={accepted({ checkIn: "2099-06-01", checkOut: "2099-06-04" })} />);
    const box = screen.getByRole("region", { name: "Versement hébergeur" });
    expect(norm(box.textContent)).toContain("Payé par le voyageur330,00 €");
    expect(norm(box.textContent)).toContain("Frais de service PetInn (payés par le voyageur)− 30,00 €");
    expect(norm(within(box).getByText("Montant net qui vous est dû").nextSibling?.textContent)).toBe("300,00 €");
    expect(within(box).getByText("À verser à l’arrivée du voyageur")).toBeInTheDocument();
  });

  it("shows the amount the host would receive on a pending request, without a payout box", () => {
    render(<RequestCard host r={accepted({ status: "en attente", paymentStatus: "autorisé" })} />);
    expect(screen.queryByRole("region", { name: "Versement hébergeur" })).toBeNull();
    expect(norm(screen.getByText(/Montant qui vous sera versé si vous acceptez/).textContent)).toContain("300,00 €");
  });

  it("keeps the traveler view on the total paid", () => {
    render(<RequestCard r={accepted()} />);
    expect(screen.queryByRole("region", { name: "Versement hébergeur" })).toBeNull();
    expect(norm(screen.getByText(/Total/).textContent)).toBe(`Total : ${norm(euros(330))} dont ${norm(euros(30))} de frais de service`);
  });
});
