import { resolveAddressMetadata, type AddressMetadata } from "../address-metadata";
import type { ValueFieldValidationOptions, ValueFieldValidationResult } from "../types";

export function validatePostalCode(
    value: string,
    country: string,
    options: ValueFieldValidationOptions,
    metadata: AddressMetadata = resolveAddressMetadata(country),
): ValueFieldValidationResult {
    // Dataset patterns are written against uppercased input.
    const normalized = value.trim().toUpperCase();
    const { postalCode } = metadata;

    if (!normalized) {
        if (!postalCode.used || !postalCode.required) {
            return { valid: true, error: null };
        }
        return { valid: false, error: options.showRequired ? "Required" : null };
    }

    if (postalCode.regex && !postalCode.regex.test(normalized)) {
        return { valid: false, error: postalCode.error };
    }
    return { valid: true, error: null };
}
