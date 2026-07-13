import { resolveAddressMetadata, type AddressMetadata } from "../address-metadata";
import type { ValueFieldValidationOptions, ValueFieldValidationResult } from "../types";

export function validateAddressState(
    value: string,
    country: string,
    options: ValueFieldValidationOptions,
    metadata: AddressMetadata = resolveAddressMetadata(country),
): ValueFieldValidationResult {
    if (value.trim()) {
        return { valid: true, error: null };
    }
    if (!metadata.state.used || !metadata.state.required) {
        return { valid: true, error: null };
    }
    return { valid: false, error: options.showRequired ? "Required" : null };
}

export function validateAddressCity(
    value: string,
    country: string,
    options: ValueFieldValidationOptions,
    metadata: AddressMetadata = resolveAddressMetadata(country),
): ValueFieldValidationResult {
    if (value.trim()) {
        return { valid: true, error: null };
    }
    if (!metadata.city.used || !metadata.city.required) {
        return { valid: true, error: null };
    }
    return { valid: false, error: options.showRequired ? "Required" : null };
}
