import { describe, expect, it, vi } from "vitest";
import {
    classifyPaymentStatus,
    createIdempotencyKey,
    describePaymentError,
    classifyIdempotencyError,
    sessionPaymentIds,
} from "./payment-outcome";

describe("classifyPaymentStatus", () => {
    it.each([
        ["succeeded", "card", "succeeded"],
        ["requires_capture", "card", "succeeded"],
        ["processing", "card", "pending"],
        ["processing", "apple_pay", "pending"],
        ["processing", "us_bank_account", "succeeded"],
        ["failed", "card", "failed"],
        ["failed", "us_bank_account", "failed"],
        ["canceled", "us_bank_account", "failed"],
        [undefined, "card", "pending"],
    ] as const)("treats %s for %s as %s", (status, method, outcome) => {
        expect(classifyPaymentStatus(status, method)).toBe(outcome);
    });
});

describe("describePaymentError", () => {
    const error = (code: string | null, message = "API message") =>
        ({ type: "invalid_request_error", code, message }) as never;

    it("reports totals conflicts without reading the session", async () => {
        const read = vi.fn();
        await expect(
            describePaymentError(error("checkout_totals_changed"), 500, read),
        ).resolves.toEqual({ message: "", totalsChanged: true });
        expect(read).not.toHaveBeenCalled();
    });

    it("explains a refused pinned amount by whether the payable amount moved", async () => {
        await expect(
            describePaymentError(error("amount_exceeds_available"), 500, async () => 500),
        ).resolves.toEqual({
            message: "A payment for this checkout is already processing.",
            totalsChanged: false,
        });
        await expect(
            describePaymentError(error("amount_mismatch"), 500, async () => 550),
        ).resolves.toEqual({ message: "", totalsChanged: true });
        await expect(
            describePaymentError(error("amount_exceeds_available"), 500, async () => {
                throw new TypeError("offline");
            }),
        ).resolves.toEqual({ message: "", totalsChanged: true });
    });

    it("explains a refused amount as in flight when earlier payments hold the whole balance", async () => {
        await expect(
            describePaymentError(error("amount_exceeds_available"), 500, async () => 0),
        ).resolves.toEqual({
            message: "A payment for this checkout is already processing.",
            totalsChanged: false,
        });
        // A partly held balance leaves a different chargeable amount for the shopper to review.
        await expect(
            describePaymentError(error("amount_exceeds_available"), 500, async () => 200),
        ).resolves.toEqual({ message: "", totalsChanged: true });
        await expect(
            describePaymentError(error("amount_mismatch"), 500, async () => 0),
        ).resolves.toEqual({ message: "", totalsChanged: true });
    });

    it("shows the customer message the API wrote", async () => {
        const decline = {
            type: "payment_error",
            code: null,
            message: "Your card was declined.",
            customer_message: "Your card was declined.",
        };
        await expect(describePaymentError(decline as never, 500, async () => 500)).resolves.toEqual(
            { message: "Your card was declined.", totalsChanged: false },
        );
        await expect(
            describePaymentError(
                {
                    type: "invalid_request_error",
                    code: "expired",
                    message: "Link 'lnk_1' expired.",
                    customer_message: "This link has expired.",
                } as never,
                500,
                async () => 500,
            ),
        ).resolves.toEqual({ message: "This link has expired.", totalsChanged: false });
    });

    it("hides API messages without a customer message, which are written for developers", async () => {
        await expect(
            describePaymentError(
                error("invoice_not_payable", "The invoice 'inv_1' is no longer awaiting payment."),
                500,
                async () => 500,
            ),
        ).resolves.toEqual({
            message: "The payment could not be completed.",
            totalsChanged: false,
        });
    });
});

describe("replay helpers", () => {
    it("classifies idempotency errors by what they say about the original request", () => {
        const classify = (type: string, code: string | null = null) =>
            classifyIdempotencyError({ type, code } as never);
        expect(classify("idempotency_error", "idempotency_key_in_use")).toBe("retry");
        expect(classify("rate_limit_error")).toBe("retry");
        expect(classify("idempotency_error", "idempotency_outcome_unknown")).toBe("reconcile");
        // Any other idempotency error (or one without a code) can't be replayed either.
        expect(classify("idempotency_error")).toBe("reconcile");
        expect(classify("idempotency_error", "something_new")).toBe("reconcile");
        expect(classify("idempotency_error", "idempotency_params_mismatch")).toBe("mismatch");
        expect(classify("payment_error")).toBe("answered");
        expect(classify("server_error")).toBe("answered");
    });

    it("snapshots the session's payment IDs only when payments are known", () => {
        expect(sessionPaymentIds(undefined)).toBeUndefined();
        expect(sessionPaymentIds({ payments: null })).toBeUndefined();
        expect(sessionPaymentIds({ payments: ["pay_1", { id: "pay_2" }, null] })).toEqual([
            "pay_1",
            "pay_2",
        ]);
    });

    it("creates a distinct key per attempt", () => {
        expect(createIdempotencyKey()).not.toBe(createIdempotencyKey());
    });
});
