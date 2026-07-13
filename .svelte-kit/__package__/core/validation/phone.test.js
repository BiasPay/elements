import { describe, expect, it } from "vitest";
import { validatePhone } from "./phone";
describe("validatePhone", () => {
    it("treats empty values as valid (phone is optional)", () => {
        expect(validatePhone("", "US", { showRequired: true })).toEqual({
            valid: true,
            error: null,
        });
        expect(validatePhone("   ", "US", { showRequired: false })).toEqual({
            valid: true,
            error: null,
        });
    });
    it("accepts valid national numbers for the billing country", () => {
        expect(validatePhone("(212) 555-0123", "US", { showRequired: true })).toEqual({
            valid: true,
            error: null,
        });
        expect(validatePhone("020 7946 0958", "GB", { showRequired: true })).toEqual({
            valid: true,
            error: null,
        });
    });
    it("accepts international numbers regardless of billing country", () => {
        expect(validatePhone("+44 20 7946 0958", "US", { showRequired: true })).toEqual({
            valid: true,
            error: null,
        });
    });
    it("rejects invalid numbers", () => {
        expect(validatePhone("123", "US", { showRequired: true })).toEqual({
            valid: false,
            error: "Your phone number is invalid.",
        });
        expect(validatePhone("not a phone", "US", { showRequired: false })).toEqual({
            valid: false,
            error: "Your phone number is invalid.",
        });
    });
});
