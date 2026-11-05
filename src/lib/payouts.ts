import type { BookingRequest } from "@/lib/store";

/**
 * Host payout for an accepted booking.
 * The traveler pays `subtotal + fee`; `subtotal` (stay + dog fees + cleaning) is owed in full
 * to the host, `fee` is PetInn's service commission. Both are computed by the database at
 * insert time and cannot be changed by clients.
 * Payouts are manual bank transfers during launch (docs/payout-procedure.md), triggered
 * within 24 h after check-in. The app does not record the transfer itself, so the status is
 * derived from the booking and the date.
 */
export type PayoutStatus = "demo" | "payment_issue" | "scheduled" | "processing" | "sent";

/** Days after check-in after which the transfer should have reached the host. */
export const PAYOUT_SETTLED_AFTER_DAYS = 5;

export type HostPayout = {
  net: number;
  fee: number;
  total: number;
  status: PayoutStatus;
  label: string;
  detail: string;
};

/** "YYYY-MM-DD" of `now` in France, so the check-in day switches at midnight Paris time. */
export function parisDay(now: Date = new Date()) {
  return now.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
}

/** "2026-12-01" → "1 décembre 2026" (no time-zone shift). */
export function frenchDate(day: string) {
  const d = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? day : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

const euroFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
/** 300 → "300,00 €"; non-finite → "—". */
export function euros(value: number) {
  return Number.isFinite(value) ? euroFormatter.format(value) : "—";
}

/** Returns null for bookings that are not accepted (nothing is owed to the host). */
export function hostPayout(r: Pick<BookingRequest, "status" | "subtotal" | "fee" | "checkIn" | "paymentStatus">, now: Date = new Date()): HostPayout | null {
  if (r.status !== "acceptée") return null;
  const net = Number(r.subtotal);
  const fee = Number(r.fee);
  const base = { net, fee, total: net + fee };

  if (r.paymentStatus === undefined) {
    return { ...base, status: "demo", label: "Réservation de démonstration", detail: "Aucun paiement n’a été encaissé : aucun versement." };
  }
  if (r.paymentStatus !== "encaissé") {
    return {
      ...base, status: "payment_issue", label: "Paiement à vérifier",
      detail: "Le paiement du voyageur n’apparaît pas comme encaissé. L’équipe PetInn vérifie avant tout versement.",
    };
  }
  const arrival = frenchDate(r.checkIn);
  if (parisDay(now) < r.checkIn) {
    return {
      ...base, status: "scheduled", label: "À verser à l’arrivée du voyageur",
      detail: `Virement déclenché sous 24 h après l’arrivée du ${arrival}, sur l’IBAN communiqué à PetInn.`,
    };
  }
  const settled = new Date(`${r.checkIn}T00:00:00Z`);
  settled.setUTCDate(settled.getUTCDate() + PAYOUT_SETTLED_AFTER_DAYS);
  if (parisDay(now) >= settled.toISOString().slice(0, 10)) {
    return {
      ...base, status: "sent", label: "Virement normalement reçu",
      detail: `Les virements partent sous 24 h après l’arrivée (ici le ${arrival}). Rien reçu ? Contactez PetInn en indiquant la date du séjour.`,
    };
  }
  return {
    ...base, status: "processing", label: "Virement en cours",
    detail: `Déclenché sous 24 h après l’arrivée du ${arrival}. Réception sous 1 à 3 jours ouvrés selon votre banque.`,
  };
}
