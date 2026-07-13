import { describe, expect, it } from "vitest";
import { parseAddressData } from "../address-metadata";
import { validatePostalCode } from "./postalCode";
// Real records from the libaddressinput dataset (US is vendored in the module).
const CA_METADATA = parseAddressData("CA", {
    fmt: "%N%n%O%n%A%n%C %S %Z",
    require: "ACSZ",
    zip: "[ABCEGHJKLMNPRSTVXY]\\d[ABCEGHJ-NPRSTV-Z] ?\\d[ABCEGHJ-NPRSTV-Z]\\d",
    zipex: "H3Z 2Y7,V8X 3X4",
});
const GB_METADATA = parseAddressData("GB", {
    fmt: "%N%n%O%n%A%n%C%n%Z",
    require: "ACZ",
    zip: "GIR ?0AA|(?:(?:AB|AL|B|BA|BB|BD|BF|BH|BL|BN|BR|BS|BT|BX|CA|CB|CF|CH|CM|CO|CR|CT|CV|CW|DA|DD|DE|DG|DH|DL|DN|DT|DY|E|EC|EH|EN|EX|FK|FY|G|GL|GY|GU|HA|HD|HG|HP|HR|HS|HU|HX|IG|IM|IP|IV|JE|KA|KT|KW|KY|L|LA|LD|LE|LL|LN|LS|LU|M|ME|MK|ML|N|NE|NG|NN|NP|NR|NW|OL|OX|PA|PE|PH|PL|PO|PR|RG|RH|RM|S|SA|SE|SG|SK|SL|SM|SN|SO|SP|SR|SS|ST|SW|SY|TA|TD|TF|TN|TQ|TR|TS|TW|UB|W|WA|WC|WD|WF|WN|WR|WS|WV|YO|ZE)(?:\\d[\\dA-Z]? ?\\d[ABD-HJLN-UW-Z]{2}))|BFPO ?\\d{1,4}",
    zipex: "EC1Y 8SY,GIR 0AA,M2 5BQ",
});
const AE_METADATA = parseAddressData("AE", {
    fmt: "%N%n%O%n%A%n%S",
    require: "AS",
});
const IE_METADATA = parseAddressData("IE", {
    fmt: "%N%n%O%n%A%n%D%n%C%n%S%n%Z",
    zip: "[\\dA-Z]{3} ?[\\dA-Z]{4}",
    zipex: "A65 F4E2",
    zip_name_type: "eircode",
});
describe("validatePostalCode", () => {
    describe("empty values", () => {
        it("returns invalid with no error when showRequired is false", () => {
            const result = validatePostalCode("", "US", { showRequired: false });
            expect(result).toEqual({ valid: false, error: null });
        });
        it("returns Required error when showRequired is true", () => {
            const result = validatePostalCode("", "US", { showRequired: true });
            expect(result).toEqual({ valid: false, error: "Required" });
        });
        it("treats whitespace as empty", () => {
            const result = validatePostalCode("   ", "US", { showRequired: true });
            expect(result).toEqual({ valid: false, error: "Required" });
        });
        it("is valid when the country has no postal codes", () => {
            const result = validatePostalCode("", "AE", { showRequired: true }, AE_METADATA);
            expect(result).toEqual({ valid: true, error: null });
        });
        it("is valid when the country's postal code is optional", () => {
            const result = validatePostalCode("", "IE", { showRequired: true }, IE_METADATA);
            expect(result).toEqual({ valid: true, error: null });
        });
    });
    describe("US (vendored metadata)", () => {
        it("accepts 5-digit and ZIP+4 codes", () => {
            expect(validatePostalCode("12345", "US", { showRequired: false }).valid).toBe(true);
            expect(validatePostalCode("22162-1010", "US", { showRequired: false }).valid).toBe(true);
        });
        it("rejects malformed ZIP codes with the ZIP error message", () => {
            const result = validatePostalCode("1234", "US", { showRequired: false });
            expect(result.valid).toBe(false);
            expect(result.error).toBe("Your ZIP code is invalid.");
            expect(validatePostalCode("1234A", "US", { showRequired: false }).valid).toBe(false);
        });
    });
    describe("CA", () => {
        it("accepts valid postal codes, with or without the space", () => {
            expect(validatePostalCode("M1A 1T1", "CA", { showRequired: false }, CA_METADATA).valid).toBe(true);
            expect(validatePostalCode("K1A0B1", "CA", { showRequired: false }, CA_METADATA).valid).toBe(true);
        });
        it("normalizes case before matching", () => {
            expect(validatePostalCode("m1a 1t1", "CA", { showRequired: false }, CA_METADATA).valid).toBe(true);
        });
        it("rejects invalid formats", () => {
            const result = validatePostalCode("12345", "CA", { showRequired: false }, CA_METADATA);
            expect(result).toEqual({ valid: false, error: "Your postal code is invalid." });
            expect(validatePostalCode("D1A 1T1", "CA", { showRequired: false }, CA_METADATA).valid).toBe(false);
        });
    });
    describe("GB", () => {
        it("accepts valid postcodes", () => {
            for (const code of ["EC1A 1BB", "W1A 0AX", "M1 1AE"]) {
                expect(validatePostalCode(code, "GB", { showRequired: false }, GB_METADATA).valid).toBe(true);
            }
        });
        it("rejects invalid formats", () => {
            const result = validatePostalCode("12345", "GB", { showRequired: false }, GB_METADATA);
            expect(result.valid).toBe(false);
            expect(result.error).toBe("Your postal code is invalid.");
        });
    });
    describe("countries without loaded metadata", () => {
        it("accepts any non-empty value", () => {
            expect(validatePostalCode("anything", "FO", { showRequired: false }).valid).toBe(true);
            expect(validatePostalCode("12345", "GL", { showRequired: false }).valid).toBe(true);
        });
    });
});
