import parsePhoneNumber, {} from "libphonenumber-js";
/** Phone is optional in the address element: empty is valid, non-empty must parse. */
export function validatePhone(value, country, _options) {
    const normalized = value.trim();
    if (!normalized) {
        return { valid: true, error: null };
    }
    const parsed = parsePhoneNumber(normalized, country);
    if (parsed?.isValid()) {
        return { valid: true, error: null };
    }
    return { valid: false, error: "Your phone number is invalid." };
}
