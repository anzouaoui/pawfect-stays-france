import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkStripeAccount, isLiveChargesDisabled } from "@/lib/stripe-config.server";

/**
 * Pre-launch readiness of the Stripe account (KYC). The check is read-only: a single
 * GET /v1/account, never a write. Test keys or an account Stripe has not activated are "not ready".
 */
const LIVE = { STRIPE_SECRET_KEY: "sk_live_51AbCdEf", STRIPE_PUBLISHABLE_KEY: "pk_live_51AbCdEf" };
const TEST = { STRIPE_SECRET_KEY: "sk_test_51AbCdEf", STRIPE_PUBLISHABLE_KEY: "pk_test_51AbCdEf" };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const activated = {
  charges_enabled: true, payouts_enabled: true, details_submitted: true, country: "FR", default_currency: "eur",
  requirements: { currently_due: [], past_due: [], disabled_reason: null },
};
const fetchMock = vi.fn();
const check = (env: Record<string, string>) => checkStripeAccount({ env, fetchImpl: fetchMock });

beforeEach(() => fetchMock.mockReset());

describe("isLiveChargesDisabled", () => {
  it("recognises Stripe's refusal for a non-activated account", () => {
    expect(isLiveChargesDisabled(400, { message: "Your account cannot currently make live charges." })).toBe(true);
    expect(isLiveChargesDisabled(403, { message: "Please activate your account to make live charges." })).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isLiveChargesDisabled(400, { message: "Invalid integer: abc" })).toBe(false);
    expect(isLiveChargesDisabled(402, { message: "Your card was declined." })).toBe(false);
    expect(isLiveChargesDisabled(500, { message: "cannot currently make live charges" })).toBe(false);
    expect(isLiveChargesDisabled(400, null)).toBe(false);
  });
});

describe("checkStripeAccount — pre-launch readiness", () => {
  it("is ready only with live keys and an activated account, using a single read-only call", async () => {
    fetchMock.mockResolvedValue(json(200, activated));
    const report = await check(LIVE);
    expect(report).toMatchObject({ ready: true, mode: "live", errors: [], warnings: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.stripe.com/v1/account");
    expect((init as RequestInit).method ?? "GET").toBe("GET");
    expect((init as RequestInit).body).toBeUndefined();
  });

  it("is never ready with test keys, even on an activated account", async () => {
    fetchMock.mockResolvedValue(json(200, activated));
    const report = await check(TEST);
    expect(report.ready).toBe(false);
    expect(report.errors[0]).toContain("mode test");
  });

  it("lists every KYC gap of a non-activated account", async () => {
    fetchMock.mockResolvedValue(json(200, {
      charges_enabled: false, payouts_enabled: false, details_submitted: false, country: "FR", default_currency: "eur",
      requirements: {
        currently_due: ["business_profile.url", "external_account"], past_due: ["representative.dob.day"],
        disabled_reason: "requirements.past_due",
      },
    }));
    const report = await check(LIVE);
    expect(report.ready).toBe(false);
    expect(report.account).toMatchObject({ chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false });
    const errors = report.errors.join("\n");
    for (const s of ["details_submitted", "charges_enabled", "payouts_enabled", "requirements.past_due", "representative.dob.day"]) {
      expect(errors).toContain(s);
    }
    expect(report.warnings.join("\n")).toContain("external_account");
  });

  it("warns about a non-French account or a non-EUR settlement currency", async () => {
    fetchMock.mockResolvedValue(json(200, { ...activated, country: "BE", default_currency: "usd" }));
    const report = await check(LIVE);
    expect(report.ready).toBe(true);
    expect(report.warnings).toEqual([expect.stringContaining("BE"), expect.stringContaining("usd")]);
  });

  it("is not ready when the activation status cannot be read", async () => {
    fetchMock.mockResolvedValueOnce(json(401, { error: { type: "invalid_request_error" } }));
    expect(await check(LIVE)).toMatchObject({ ready: false, errors: [expect.stringContaining("401")] });
    fetchMock.mockResolvedValueOnce(json(403, { error: { type: "invalid_request_error" } }));
    expect(await check({ ...LIVE, STRIPE_SECRET_KEY: "rk_live_123" })).toMatchObject({ ready: false, errors: [expect.stringContaining("Clé restreinte")] });
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    expect(await check(LIVE)).toMatchObject({ ready: false, errors: [expect.stringContaining("injoignable")] });
  });

  it("does not call Stripe when the keys are invalid, and never echoes them", async () => {
    const report = await check({ STRIPE_SECRET_KEY: "sk_live_51AbCdEf", STRIPE_PUBLISHABLE_KEY: "pk_test_51AbCdEf" });
    expect(report.ready).toBe(false);
    expect(report.errors[0]).toContain("incohérentes");
    expect(report.errors.join("")).not.toContain("51AbCdEf");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
