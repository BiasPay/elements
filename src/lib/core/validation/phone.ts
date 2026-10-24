import parsePhoneNumber, { type CountryCode } from "libphonenumber-js";
import type { ValueFieldValidationOptions, ValueFieldValidationResult } from "../types";

/** A collected phone is required; non-empty values must parse for the address country. */
export function validatePhone(
    value: string,
    country: string,
    options: ValueFieldValidationOptions,
): ValueFieldValidationResult {
    const normalized = value.trim();
    if (!normalized) {
        return { valid: false, error: options.showRequired ? "Required" : null };
    }

    const parsed = parsePhoneNumber(normalized, country as CountryCode);
    if (parsed?.isValid()) {
        return { valid: true, error: null };
    }
    return { valid: false, error: "Your phone number is invalid." };
}
