import type { BiasElementsError, BiasElementsErrorCode } from "./public-types";
export declare function elementsError(code: BiasElementsErrorCode, message?: string): BiasElementsError;
export declare function normalizeSessionError(value: unknown): BiasElementsError;
