import type { BiasElementsError, BiasElementsErrorCode } from "./public-types";

const DEFAULT_MESSAGES: Record<BiasElementsErrorCode, string> = {
    authentication_failed: "The checkout session could not be authenticated.",
    session_load_failed: "The checkout session could not be loaded.",
    session_update_failed: "The checkout details could not be saved.",
    payment_failed: "The payment could not be completed.",
    frame_failed: "The secure payment field failed.",
    configuration_error: "Bias Elements is configured incorrectly.",
};

const RETRYABLE: Record<BiasElementsErrorCode, boolean> = {
    authentication_failed: false,
    session_load_failed: true,
    session_update_failed: true,
    payment_failed: true,
    frame_failed: true,
    configuration_error: false,
};

export function elementsError(
    code: BiasElementsErrorCode,
    message = DEFAULT_MESSAGES[code],
): BiasElementsError {
    const error = new Error(message) as BiasElementsError;
    Object.defineProperties(error, {
        code: { value: code, enumerable: true },
        retryable: { value: RETRYABLE[code], enumerable: true },
    });
    return error;
}

export function normalizeSessionError(value: unknown): BiasElementsError {
    const record = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
    const status = typeof record?.status === "number" ? record.status : undefined;
    const type = typeof record?.type === "string" ? record.type : undefined;
    const code =
        status === 401 || status === 403 || type === "authentication_error"
            ? "authentication_failed"
            : "session_load_failed";
    return elementsError(code);
}
