import type { FieldValueMap, ValueFieldType, ValueFieldValidationOptions, ValueFieldValidationResult, ValueFieldValidator } from "../types";
/**
 * Default field validation: truthy value = valid, empty = "Required" (if showRequired).
 * Used when no custom validator is registered for a field.
 */
export declare function defaultFieldValidation<K extends ValueFieldType>(value: FieldValueMap[K], options: ValueFieldValidationOptions): ValueFieldValidationResult;
/**
 * Run validation for a field, using the registered validator or the default.
 * Country-scoped fields (postal code, state, city) default to address-metadata
 * validation so they behave correctly even when no input is mounted for them.
 */
export declare function getFieldValidation<K extends ValueFieldType>(type: K, value: FieldValueMap[K], options: ValueFieldValidationOptions, validators: Partial<{
    [K in ValueFieldType]: ValueFieldValidator<K>;
}>, country: string): ValueFieldValidationResult;
