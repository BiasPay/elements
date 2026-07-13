import type {
    FieldValueMap,
    ValueFieldType,
    ValueFieldValidationOptions,
    ValueFieldValidationResult,
    ValueFieldValidator,
} from "../types";
import { validateAddressCity, validateAddressState } from "./address";
import { validateEmail } from "./email";
import { validatePostalCode } from "./postalCode";

/**
 * Default field validation: truthy value = valid, empty = "Required" (if showRequired).
 * Used when no custom validator is registered for a field.
 */
export function defaultFieldValidation<K extends ValueFieldType>(
    value: FieldValueMap[K],
    options: ValueFieldValidationOptions,
): ValueFieldValidationResult {
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
export function getFieldValidation<K extends ValueFieldType>(
    type: K,
    value: FieldValueMap[K],
    options: ValueFieldValidationOptions,
    validators: Partial<{ [K in ValueFieldType]: ValueFieldValidator<K> }>,
    country: string,
): ValueFieldValidationResult {
    const validator = validators[type] as ValueFieldValidator<K> | undefined;
    if (validator) return validator(value, options);
    if (type === "email") return validateEmail(value as string, options);
    if (type === "postalCode" || type === "shippingPostalCode")
        return validatePostalCode(value as string, country, options);
    if (type === "state" || type === "shippingState")
        return validateAddressState(value as string, country, options);
    if (type === "city" || type === "shippingCity")
        return validateAddressCity(value as string, country, options);
    return defaultFieldValidation(value, options);
}
