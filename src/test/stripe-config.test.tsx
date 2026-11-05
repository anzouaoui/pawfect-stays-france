import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { checkStripeConfig, checkSecretKey, logStripeConfigError } from "@/lib/stripe-config.server";

const SK_TEST = "sk_test_51AbCdEf";
const PK_TEST = "pk_test_51AbCdEf";
const SK_LIVE = "sk_live_51AbCdEf";
const PK_LIVE = "pk_live_51AbCdEf";

describe("Stripe key validation", () => {
  it("accepts consistent test keys and live keys", () => {
    expect(checkStripeConfig({ STRIPE_SECRET_KEY: SK_TEST, STRIPE_PUBLISHABLE_KEY: PK_TEST })).toEqual({
      ok: true, secretKey: SK_TEST, publishableKey: PK_TEST, mode: "test",
    });
    expect(checkStripeConfig({ STRIPE_SECRET_KEY: SK_LIVE, STRIPE_PUBLISHABLE_KEY: PK_LIVE })).toMatchObject({ ok: true, mode: "live" });
  });

  it("accepts restricted secret keys and the VITE_ fallback for the publishable key", () => {
    expect(checkStripeConfig({ STRIPE_SECRET_KEY: "rk_test_123", VITE_STRIPE_PUBLISHABLE_KEY: PK_TEST })).toMatchObject({ ok: true, mode: "test" });
  });

  it("reports a missing secret key", () => {
    expect(checkStripeConfig({ STRIPE_PUBLISHABLE_KEY: PK_TEST })).toMatchObject({ ok: false, code: "missing_secret_key" });
    expect(checkSecretKey({ STRIPE_SECRET_KEY: "   " })).toMatchObject({ ok: false, code: "missing_secret_key" });
  });

  it("reports a missing publishable key", () => {
    expect(checkStripeConfig({ STRIPE_SECRET_KEY: SK_TEST })).toMatchObject({ ok: false, code: "missing_publishable_key" });
  });

  it("refuses a secret key in the publishable slot", () => {
    for (const leaked of [SK_TEST, "sk_live_xyz", "rk_live_xyz"]) {
      const check = checkStripeConfig({ STRIPE_SECRET_KEY: SK_TEST, STRIPE_PUBLISHABLE_KEY: leaked });
      expect(check).toMatchObject({ ok: false, code: "publishable_key_is_secret" });
      expect(!check.ok && check.detail).not.toContain(leaked);
    }
  });

  it("refuses malformed keys without echoing them", () => {
    const badSecret = checkStripeConfig({ STRIPE_SECRET_KEY: "pk_test_oops", STRIPE_PUBLISHABLE_KEY: PK_TEST });
    expect(badSecret).toMatchObject({ ok: false, code: "invalid_secret_key" });
    expect(!badSecret.ok && badSecret.detail).not.toContain("pk_test_oops");
    expect(checkStripeConfig({ STRIPE_SECRET_KEY: SK_TEST, STRIPE_PUBLISHABLE_KEY: "abc" })).toMatchObject({ ok: false, code: "invalid_publishable_key" });
  });

  it("detects a test/live mismatch in both directions", () => {
    expect(checkStripeConfig({ STRIPE_SECRET_KEY: SK_LIVE, STRIPE_PUBLISHABLE_KEY: PK_TEST })).toMatchObject({ ok: false, code: "mode_mismatch" });
    expect(checkStripeConfig({ STRIPE_SECRET_KEY: SK_TEST, STRIPE_PUBLISHABLE_KEY: PK_LIVE })).toMatchObject({ ok: false, code: "mode_mismatch" });
  });

  it("logs each configuration problem once, without the key", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const check = checkStripeConfig({ STRIPE_SECRET_KEY: SK_LIVE, STRIPE_PUBLISHABLE_KEY: PK_TEST });
    if (check.ok) throw new Error("expected failure");
    logStripeConfigError(check);
    logStripeConfigError(check);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]![0])).not.toContain(SK_LIVE);
    spy.mockRestore();
  });
});

// --- CardHoldForm: no silent hang when the key is unavailable -------------------------
const getStripeKey = vi.hoisted(() => vi.fn());
const loadStripe = vi.hoisted(() => vi.fn());
vi.mock("@/lib/payments.functions", () => ({ getStripeKey }));
vi.mock("@stripe/stripe-js", () => ({ loadStripe }));
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div data-testid="elements">{children}</div>,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => null,
  useElements: () => null,
}));

describe("CardHoldForm", () => {
  beforeEach(() => {
    vi.resetModules();
    getStripeKey.mockReset();
    loadStripe.mockReset();
  });

  const renderForm = async () => {
    const { CardHoldForm } = await import("@/components/CardHoldForm");
    return render(<CardHoldForm clientSecret="pi_1_secret_2" total={330} onDone={async () => {}} />);
  };

  it("shows the server's safe error and a retry button when the key is unavailable", async () => {
    getStripeKey.mockResolvedValueOnce({ key: "", error: "Le service de paiement est momentanément indisponible. Réessayez dans quelques minutes." });
    await renderForm();
    expect(await screen.findByRole("alert")).toHaveTextContent("momentanément indisponible");
    expect(loadStripe).not.toHaveBeenCalled();

    getStripeKey.mockResolvedValueOnce({ key: PK_TEST, mode: "test" });
    loadStripe.mockResolvedValueOnce({});
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByTestId("payment-element")).toBeInTheDocument();
    expect(loadStripe).toHaveBeenCalledWith(PK_TEST);
  });

  it("shows an error when the key request itself fails", async () => {
    getStripeKey.mockRejectedValueOnce(new Error(""));
    await renderForm();
    expect(await screen.findByRole("alert")).toHaveTextContent("momentanément indisponible");
  });

  it("shows an error when Stripe.js cannot load", async () => {
    getStripeKey.mockResolvedValueOnce({ key: PK_TEST, mode: "test" });
    loadStripe.mockResolvedValueOnce(null);
    await renderForm();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  it("renders the payment form when the key is valid", async () => {
    getStripeKey.mockResolvedValueOnce({ key: PK_TEST, mode: "test" });
    loadStripe.mockResolvedValueOnce({});
    await renderForm();
    expect(await screen.findByTestId("payment-element")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bloquer 330 €/ })).toBeDisabled();
  });
});
