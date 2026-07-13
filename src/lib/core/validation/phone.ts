import parsePhoneNumber, { type CountryCode } from "libphonenumber-js";
import type { ValueFieldValidationOptions, ValueFieldValidationResult } from "../types";

/** Phone is optional in the address element: empty is valid, non-empty must parse. */
export function validatePhone(
    value: string,
    country: string,
    _options: ValueFieldValidationOptions,
): ValueFieldValidationResult {
    const normalized = value.trim();
    if (!normalized) {
        return { valid: true, error: null };
    }

    const parsed = parsePhoneNumber(normalized, country as CountryCode);
    if (parsed?.isValid()) {
        return { valid: true, error: null };
    }
    return { valid: false, error: "Your phone number is invalid." };
}
