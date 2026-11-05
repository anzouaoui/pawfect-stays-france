/** Mandatory acceptance of the CGU and cancellation policy before a booking request / card hold. */
export function BookingConsent({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const link = "font-medium underline underline-offset-2";
  return (
    <div className="mt-6 flex items-start gap-3 rounded-xl border bg-secondary/40 p-4 text-sm">
      <input
        id="booking-consent"
        type="checkbox"
        required
        aria-required="true"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <label htmlFor="booking-consent">
        J’accepte les{" "}
        <a href="/cgu" target="_blank" rel="noopener noreferrer" className={link}>Conditions Générales d’Utilisation</a>{" "}
        et la{" "}
        <a href="/annulation" target="_blank" rel="noopener noreferrer" className={link}>Politique d’annulation</a>{" "}
        de PetInn.
      </label>
    </div>
  );
}

export const CARD_HOLD_NOTICE = "Votre carte bancaire ne sera débitée que si l’hôte accepte votre demande sous 24 h.";
