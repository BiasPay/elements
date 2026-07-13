import { type AddressMetadata } from "../address-metadata";
import type { ValueFieldValidationOptions, ValueFieldValidationResult } from "../types";
export declare function validatePostalCode(value: string, country: string, options: ValueFieldValidationOptions, metadata?: AddressMetadata): ValueFieldValidationResult;
