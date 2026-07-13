import type { ValueFieldValidationOptions, ValueFieldValidationResult } from "../types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(
    value: string,
    options: ValueFieldValidationOptions,
): ValueFieldValidationResult {
    const normalized = value.trim();
    if (!normalized) {
        return { valid: false, error: options.showRequired ? "Required" : null };
    }
    if (!EMAIL_PATTERN.test(normalized)) {
        return { valid: false, error: "Enter a valid email address" };
    }
    return { valid: true, error: null };
}
