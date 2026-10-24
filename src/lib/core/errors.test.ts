import { describe, expect, it } from "vitest";
import { elementsError, normalizeSessionError } from "./errors";

describe("session errors", () => {
    it("keeps the API error type so callers can tell server errors from network failures", () => {
        expect(normalizeSessionError({ type: "server_error", status: 500 })).toMatchObject({
            code: "session_load_failed",
            apiErrorType: "server_error",
        });
        expect(
            normalizeSessionError(new TypeError("Failed to fetch")).apiErrorType,
        ).toBeUndefined();
        expect(normalizeSessionError({ status: 401 })).toMatchObject({
            code: "authentication_failed",
        });
    });

    it("carries the API's customer message only when it wrote one", () => {
        expect(
            elementsError(
                "session_update_failed",
                "dev detail",
                "invalid_request_error",
                "Try again.",
            ),
        ).toMatchObject({ message: "dev detail", customerMessage: "Try again." });
        expect(
            elementsError("session_update_failed", "dev detail", "invalid_request_error", null),
        ).not.toHaveProperty("customerMessage");
    });
});
