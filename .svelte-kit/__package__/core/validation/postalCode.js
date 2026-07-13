import { resolveAddressMetadata } from "../address-metadata";
export function validatePostalCode(value, country, options, metadata = resolveAddressMetadata(country)) {
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
