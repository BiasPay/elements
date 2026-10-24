import type { Error as ApiError, PaymentCreateParams } from "@biaspay/sdk-checkout";
import { PAYMENT_NOT_COMPLETED_MESSAGE } from "./errors";

/**
 * How a checkout should treat a payment's status. One classifier is shared by
 * every path that sees a payment (the create response, an idempotent replay,
 * and session polling) so they can never disagree about the same status.
 */
export type PaymentOutcome = "succeeded" | "failed" | "pending";

export function classifyPaymentStatus(status: unknown, method: string): PaymentOutcome {
    switch (status) {
        case "succeeded":
        // Authorized for later capture by the merchant: the shopper's part is done.
        case "requires_capture":
            return "succeeded";
        case "processing":
            // Bank debits stay processing until settlement; the API accepted them. Other
            // methods are processing only while the processor outcome is still unknown.
            return method === "us_bank_account" ? "succeeded" : "pending";
        case "failed":
        case "canceled":
            return "failed";
        default:
            return "pending";
    }
}

export const PAYMENT_PROCESSING_MESSAGE =
    "Your payment is processing. You'll receive a confirmation once it completes.";
export const PAYMENT_FAILED_MESSAGE = "The payment failed and may now be retried.";
export const PAYMENT_IN_FLIGHT_MESSAGE = "A payment for this checkout is already processing.";

/** The parts of a payment that decide an attempt's outcome. */
export type ObservedPayment = {
    readonly id: string;
    readonly status: string;
    readonly payment_error?: { readonly message?: string | null } | null;
};

export function failedPaymentMessage(payment: Pick<ObservedPayment, "payment_error">): string {
    return payment.payment_error?.message || PAYMENT_FAILED_MESSAGE;
}

/**
 * One payment request as it was dispatched. Ambiguous outcomes (network errors,
 * timeouts, an abandoned request) are resolved by re-sending exactly `params`
 * with `idempotencyKey`: the API then replays the original response, or reports
 * that the original request is still running. A different body would be refused.
 */
export type PaymentAttempt = {
    readonly method: string;
    readonly idempotencyKey: string;
    readonly params: Readonly<PaymentCreateParams>;
    /** The amount pinned in `params`, when one was. */
    readonly sentAmount: number | undefined;
    /**
     * The session's payments when the attempt was dispatched, when known: a payment
     * that appears later with the sent amount may be this attempt's own.
     */
    readonly knownPaymentIds?: readonly string[];
};

export function createIdempotencyKey(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return `elements_${crypto.randomUUID()}`;
    }
    const random = () => Math.random().toString(36).slice(2, 12);
    return `elements_${Date.now().toString(36)}_${random()}${random()}`;
}

export type PaymentFailure = { readonly message: string; readonly totalsChanged: boolean };

/** The API's `customer_message` when it wrote one for the shopper; otherwise a generic message. */
export function shopperErrorMessage(error: { customer_message?: string | null }): string {
    return error.customer_message || PAYMENT_NOT_COMPLETED_MESSAGE;
}

/**
 * The shopper-facing failure for a payment request the API answered with an error.
 * `currentAmountRemaining` reads what the session has left to charge the method now
 * (the API's `amount_remaining`, net of in-flight payments). A refused pinned amount
 * is a total change when that moved to another chargeable amount; when it is unchanged,
 * or nothing is left because earlier payments hold the balance, a payment is in flight.
 */
export async function describePaymentError(
    error: ApiError["error"],
    sentAmount: number | undefined,
    currentAmountRemaining: () => Promise<number | undefined>,
): Promise<PaymentFailure> {
    if (error.code === "checkout_totals_changed") return { message: "", totalsChanged: true };
    if (
        sentAmount !== undefined &&
        (error.code === "amount_exceeds_available" || error.code === "amount_mismatch")
    ) {
        let current: number | undefined;
        try {
            current = await currentAmountRemaining();
        } catch {
            // Unknown current total; treat it as changed so the shopper reviews it.
        }
        const heldByEarlierPayment = error.code === "amount_exceeds_available" && current === 0;
        if (current !== sentAmount && !heldByEarlierPayment) {
            return { message: "", totalsChanged: true };
        }
        if (error.code === "amount_exceeds_available") {
            // The API message names internal IDs, so don't show it to the shopper.
            return { message: PAYMENT_IN_FLIGHT_MESSAGE, totalsChanged: false };
        }
    }
    return { message: shopperErrorMessage(error), totalsChanged: false };
}

/**
 * What an error answering a request sent with an attempt's idempotency key says
 * about the attempt:
 * - `retry`: nothing yet. Another request with the key is still running
 *   (`idempotency_key_in_use`), or the request was throttled; re-send it later.
 * - `reconcile`: the key can never replay the original outcome
 *   (`idempotency_outcome_unknown`, e.g. the original exceeded its processing lease,
 *   or any other idempotency error); look for the outcome on the checkout session.
 * - `mismatch`: the key was used with a different request
 *   (`idempotency_params_mismatch`); re-sending can't help.
 * - `answered`: the API's own answer for the request.
 */
export type IdempotencyErrorMeaning = "retry" | "reconcile" | "mismatch" | "answered";

export function classifyIdempotencyError(error: ApiError["error"]): IdempotencyErrorMeaning {
    if (error.type === "rate_limit_error") return "retry";
    if (error.type !== "idempotency_error") return "answered";
    // Widened: API versions before these codes send `code: null` for idempotency errors.
    const code: string | null | undefined = (error as { code?: string | null }).code;
    if (code === "idempotency_key_in_use") return "retry";
    if (code === "idempotency_params_mismatch") return "mismatch";
    return "reconcile";
}

/** An attempt whose outcome neither its idempotency key nor the session could confirm. */
export const PAYMENT_UNCONFIRMED_MESSAGE =
    "We couldn't confirm your payment. Check with the merchant before trying again.";

/** The generic payment messages, reworded for a checkout that only saves a payment method. */
const SETUP_MESSAGES: Record<string, string> = {
    [PAYMENT_NOT_COMPLETED_MESSAGE]: "Your payment method could not be saved.",
    [PAYMENT_FAILED_MESSAGE]: "Your payment method could not be saved. Try again.",
    [PAYMENT_PROCESSING_MESSAGE]:
        "Your payment method is being verified. You'll receive a confirmation once it's saved.",
    [PAYMENT_IN_FLIGHT_MESSAGE]: "This payment method is already being saved.",
    [PAYMENT_UNCONFIRMED_MESSAGE]:
        "We couldn't confirm your payment method was saved. Check with the merchant before trying again.",
};

export function setupMessage(message: string): string | undefined {
    return SETUP_MESSAGES[message];
}

/** The IDs of the session's expanded payments, to tell an attempt's own payment apart later. */
export function sessionPaymentIds(
    session: { readonly payments?: readonly unknown[] | null } | undefined,
): readonly string[] | undefined {
    if (!session || !Array.isArray(session.payments)) return undefined;
    return session.payments.flatMap((payment) =>
        typeof payment === "string"
            ? [payment]
            : payment &&
                typeof payment === "object" &&
                "id" in payment &&
                typeof payment.id === "string"
              ? [payment.id]
              : [],
    );
}
