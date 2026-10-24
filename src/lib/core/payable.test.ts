import type { CheckoutSession } from "@biaspay/sdk-checkout";
import { describe, expect, it } from "vitest";
import { checkoutAmountRemaining } from "./payable";

type RemainingSession = Pick<CheckoutSession, "amount_remaining" | "dual_pricing">;

/** A session as the API returns it: the remaining amounts are server-computed. */
function session(overrides: Partial<RemainingSession>): RemainingSession {
    return { amount_remaining: 2_946, dual_pricing: null, ...overrides };
}

describe("checkoutAmountRemaining", () => {
    it("uses the dual-pricing remaining amount for card only", () => {
        const priced = session({ dual_pricing: { rate: 3, amount_remaining: 3_034 } });
        expect(checkoutAmountRemaining(priced, "card")).toBe(3_034);
        expect(checkoutAmountRemaining(priced, "apple_pay")).toBe(3_034);
        expect(checkoutAmountRemaining(priced, "us_bank_account")).toBe(2_946);
        expect(checkoutAmountRemaining(priced, undefined)).toBe(2_946);
    });

    it("uses amount_remaining for cards without dual pricing", () => {
        expect(checkoutAmountRemaining(session({ amount_remaining: 1_946 }), "card")).toBe(1_946);
    });

    it("reports what the server leaves after a partial payment, markup on the gross total", () => {
        // total 2946 at 3%: 3034 payable by card, $10.00 already collected.
        const partial = session({
            amount_remaining: 1_946,
            dual_pricing: { rate: 3, amount_remaining: 2_034 },
        });
        expect(checkoutAmountRemaining(partial, "apple_pay")).toBe(2_034);
        expect(checkoutAmountRemaining(partial, "us_bank_account")).toBe(1_946);
    });

    it("reflects in-flight payments the server already subtracted", () => {
        // A $20.00 bank payment still processing on a $29.46 session.
        expect(checkoutAmountRemaining(session({ amount_remaining: 946 }), "us_bank_account")).toBe(
            946,
        );
    });

    it("is zero when nothing is left or the value is unusable", () => {
        expect(checkoutAmountRemaining(session({ amount_remaining: 0 }), "card")).toBe(0);
        expect(checkoutAmountRemaining(session({ amount_remaining: Number.NaN }), "card")).toBe(0);
    });
});
