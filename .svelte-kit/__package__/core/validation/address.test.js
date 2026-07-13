import { describe, expect, it } from "vitest";
import { parseAddressData } from "../address-metadata";
import { validateAddressCity, validateAddressState } from "./address";
const GB_METADATA = parseAddressData("GB", {
    fmt: "%N%n%O%n%A%n%C%n%Z",
    require: "ACZ",
});
const AE_METADATA = parseAddressData("AE", {
    fmt: "%N%n%O%n%A%n%S",
    require: "AS",
});
describe("validateAddressState", () => {
    it("accepts any non-empty value", () => {
        expect(validateAddressState("NY", "US", { showRequired: true })).toEqual({
            valid: true,
            error: null,
        });
        expect(validateAddressState("Bavaria", "DE", { showRequired: true })).toEqual({
            valid: true,
            error: null,
        });
    });
    it("rejects empty values for state-required countries", () => {
        // US uses the vendored metadata; CA falls back to the legacy default.
        expect(validateAddressState("", "US", { showRequired: true })).toEqual({
            valid: false,
            error: "Required",
        });
        expect(validateAddressState("  ", "CA", { showRequired: false })).toEqual({
            valid: false,
            error: null,
        });
        expect(validateAddressState("", "AE", { showRequired: true }, AE_METADATA)).toEqual({
            valid: false,
            error: "Required",
        });
    });
    it("accepts empty values for countries without a state line", () => {
        expect(validateAddressState("", "GB", { showRequired: true }, GB_METADATA)).toEqual({
            valid: true,
            error: null,
        });
    });
});
describe("validateAddressCity", () => {
    it("requires a city by default", () => {
        expect(validateAddressCity("", "US", { showRequired: true })).toEqual({
            valid: false,
            error: "Required",
        });
        expect(validateAddressCity("Portland", "US", { showRequired: true })).toEqual({
            valid: true,
            error: null,
        });
    });
    it("accepts empty values for countries without a city line", () => {
        expect(validateAddressCity("", "AE", { showRequired: true }, AE_METADATA)).toEqual({
            valid: true,
            error: null,
        });
    });
});
