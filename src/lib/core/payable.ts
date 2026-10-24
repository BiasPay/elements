import type { CheckoutSession } from "@biaspay/sdk-checkout";

/** Payment methods charged the session's dual-pricing card markup. */
function paysCardMarkup(method: string | undefined): boolean {
    return method === "card" || method === "apple_pay";
}

/**
 * What a payment with the method and no explicit `amount` would charge on the
 * session right now, in cents, as the API reports it: `dual_pricing.amount_remaining`
 * (card markup included) for card, `amount_remaining` otherwise. The
 * server nets out collected and in-flight payments, so the displayed, wallet and
 * charged amounts all come from one source. Only sessions read, created or updated
 * directly carry in-flight-aware values; never feed this an event payload.
 */
export function checkoutAmountRemaining(
    session: Pick<CheckoutSession, "amount_remaining" | "dual_pricing">,
    method: string | undefined,
): number {
    const remaining =
        (paysCardMarkup(method) ? session.dual_pricing?.amount_remaining : undefined) ??
        session.amount_remaining;
    return Number.isSafeInteger(remaining) && remaining > 0 ? remaining : 0;
}

/** A subscription whose first period is free: its $0 payment only saves the method. */
export function subscriptionFreeToday(session: Pick<CheckoutSession, "mode" | "total">): boolean {
    return session.mode === "subscription" && session.total === 0;
}
