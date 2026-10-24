import { describe, expect, it } from "vitest";
import { isEnteredDiscountCode } from "./discounts";

describe("entered discount codes", () => {
    it("recognizes codes without treating automatic discounts as entered codes", () => {
        expect(isEnteredDiscountCode({ code: "WELCOME" })).toBe(true);
        expect(isEnteredDiscountCode({ code: null })).toBe(false);
    });
});
