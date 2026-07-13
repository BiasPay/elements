import type { ValueFieldValidationOptions, ValueFieldValidationResult } from "../types";
/** Phone is optional in the address element: empty is valid, non-empty must parse. */
export declare function validatePhone(value: string, country: string, _options: ValueFieldValidationOptions): ValueFieldValidationResult;
