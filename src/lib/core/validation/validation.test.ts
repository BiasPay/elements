import { describe, expect, it } from "vitest";
import { defaultFieldValidation, getFieldValidation } from "./index";
import type { ValueFieldValidator } from "../types";

describe("defaultFieldValidation", () => {
    it("returns valid for truthy values", () => {
        expect(defaultFieldValidation("hello", { showRequired: false })).toEqual({
            valid: true,
            error: null,
        });
    });

    it("returns invalid with no error for empty when showRequired is false", () => {
        expect(defaultFieldValidation("", { showRequired: false })).toEqual({
            valid: false,
            error: null,
        });
    });

    it("returns invalid with 'Required' error when showRequired is true", () => {
        expect(defaultFieldValidation("", { showRequired: true })).toEqual({
            valid: false,
            error: "Required",
        });
    });
});

describe("getFieldValidation", () => {
    it("uses default validation when no custom validator is registered", () => {
        const result = getFieldValidation("name", "John", { showRequired: false }, {}, "US");
        expect(result).toEqual({ valid: true, error: null });
    });

    it("uses default validation for empty value with no custom validator", () => {
        const result = getFieldValidation("name", "", { showRequired: true }, {}, "US");
        expect(result).toEqual({ valid: false, error: "Required" });
    });

    it("uses custom validator when registered", () => {
        const customValidator: ValueFieldValidator<"name"> = (value, _options) => ({
            valid: value.length >= 3,
            error: value.length >= 3 ? null : "Name too short",
        });

        const result = getFieldValidation(
            "name",
            "Jo",
            { showRequired: false },
            {
                name: customValidator,
            },
            "US",
        );
        expect(result).toEqual({ valid: false, error: "Name too short" });
    });

    it("custom validator overrides default for valid values", () => {
        const customValidator: ValueFieldValidator<"name"> = (value) => ({
            valid: value === "allowed",
            error: value === "allowed" ? null : "Not allowed",
        });

        const result = getFieldValidation(
            "name",
            "something",
            { showRequired: false },
            {
                name: customValidator,
            },
            "US",
        );
        expect(result).toEqual({ valid: false, error: "Not allowed" });
    });

    it("uses default for fields without a registered validator even when others are registered", () => {
        const result = getFieldValidation(
            "country",
            "US",
            { showRequired: false },
            {
                name: ((_v: string) => ({
                    valid: false,
                    error: "nope",
                })) as ValueFieldValidator<"name">,
            },
            "US",
        );
        expect(result).toEqual({ valid: true, error: null });
    });
});
