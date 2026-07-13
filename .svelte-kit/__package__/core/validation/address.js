import { resolveAddressMetadata } from "../address-metadata";
export function validateAddressState(value, country, options, metadata = resolveAddressMetadata(country)) {
    if (value.trim()) {
        return { valid: true, error: null };
    }
    if (!metadata.state.used || !metadata.state.required) {
        return { valid: true, error: null };
    }
    return { valid: false, error: options.showRequired ? "Required" : null };
}
export function validateAddressCity(value, country, options, metadata = resolveAddressMetadata(country)) {
    if (value.trim()) {
        return { valid: true, error: null };
    }
    if (!metadata.city.used || !metadata.city.required) {
        return { valid: true, error: null };
    }
    return { valid: false, error: options.showRequired ? "Required" : null };
}
