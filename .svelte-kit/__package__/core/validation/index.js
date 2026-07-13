import { validateAddressCity, validateAddressState } from "./address";
import { validateEmail } from "./email";
import { validatePostalCode } from "./postalCode";
/**
 * Default field validation: truthy value = valid, empty = "Required" (if showRequired).
 * Used when no custom validator is registered for a field.
 */
export function defaultFieldValidation(value, options) {
    return {
        valid: !!value,
        error: value ? null : options.showRequired ? "Required" : null,
    };
}
/**
 * Run validation for a field, using the registered validator or the default.
 * Country-scoped fields (postal code, state, city) default to address-metadata
 * validation so they behave correctly even when no input is mounted for them.
 */
export function getFieldValidation(type, value, options, validators, country) {
    const validator = validators[type];
    if (validator)
        return validator(value, options);
    if (type === "email")
        return validateEmail(value, options);
    if (type === "postalCode" || type === "shippingPostalCode")
        return validatePostalCode(value, country, options);
    if (type === "state" || type === "shippingState")
        return validateAddressState(value, country, options);
    if (type === "city" || type === "shippingCity")
        return validateAddressCity(value, country, options);
    return defaultFieldValidation(value, options);
}
