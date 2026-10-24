import { describe, expect, it } from "vitest";
import { mergeCheckoutSessionExpand } from "./endpoints";

describe("mergeCheckoutSessionExpand", () => {
    it("adds the expansions Elements requires", () => {
        expect(mergeCheckoutSessionExpand()).toEqual({ discounts: true, payments: true });
    });

    it("keeps nested expansions the caller configured", () => {
        expect(
            mergeCheckoutSessionExpand({
                discounts: { discount: true },
                payments: { payment_method: true },
                invoice: { customer: true },
            }),
        ).toEqual({
            discounts: { discount: true },
            payments: { payment_method: true },
            invoice: { customer: true },
        });
    });
});
