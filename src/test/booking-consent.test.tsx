import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { BookingConsent, CARD_HOLD_NOTICE } from "@/components/BookingConsent";
import { LEGAL_VERSIONS, TERMS_VERSION, legalDate } from "@/lib/legal";

/** Mirrors the booking page: the submit button stays disabled until consent is given. */
function Harness({ onSubmit }: { onSubmit: () => void }) {
  const [accepted, setAccepted] = useState(false);
  return (
    <>
      <BookingConsent checked={accepted} onChange={setAccepted} />
      <button disabled={!accepted} onClick={onSubmit}>Continuer vers le paiement sécurisé</button>
    </>
  );
}

describe("Booking consent checkbox", () => {
  it("is unchecked by default, required, and labelled with the exact consent text", () => {
    render(<BookingConsent checked={false} onChange={() => {}} />);
    const box = screen.getByRole("checkbox", { name: "J’accepte les Conditions Générales d’Utilisation et la Politique d’annulation de PetInn." });
    expect(box).not.toBeChecked();
    expect(box).toBeRequired();
  });

  it("opens the CGU and the cancellation policy in a new tab", () => {
    render(<BookingConsent checked={false} onChange={() => {}} />);
    for (const [name, href] of [["Conditions Générales d’Utilisation", "/cgu"], ["Politique d’annulation", "/annulation"]] as const) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    }
  });

  it("clicking a link does not tick the box", () => {
    const onChange = vi.fn();
    render(<BookingConsent checked={false} onChange={onChange} />);
    const link = screen.getByRole("link", { name: "Conditions Générales d’Utilisation" });
    link.addEventListener("click", (e) => e.preventDefault()); // jsdom cannot open tabs
    fireEvent.click(link);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the submit button disabled until the box is ticked", () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const button = screen.getByRole("button", { name: "Continuer vers le paiement sécurisé" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText(/J’accepte les/));
    expect(button).toBeDisabled();
  });

  it("states that the card is only charged if the host accepts within 24 h", () => {
    expect(CARD_HOLD_NOTICE).toBe("Votre carte bancaire ne sera débitée que si l’hôte accepte votre demande sous 24 h.");
  });

  it("derives the recorded terms version from the dates shown on the legal pages", () => {
    expect(TERMS_VERSION).toBe(`cgu:${LEGAL_VERSIONS.cgu};annulation:${LEGAL_VERSIONS.annulation}`);
    expect(legalDate(LEGAL_VERSIONS.cgu)).toBe("6 novembre 2026");
    expect(legalDate(LEGAL_VERSIONS.annulation)).toBe("27 octobre 2026");
  });
});
