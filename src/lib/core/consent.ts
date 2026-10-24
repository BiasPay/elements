import type { CheckoutSession, PaymentCreateParams } from "@biaspay/sdk-checkout";

export type AccountHolderType = "individual" | "company";

type ConsentCheckoutSession = Pick<
    CheckoutSession,
    "mode" | "subscription_terms" | "mandate_text" | "company_mandate_text"
>;

export const SUBSCRIPTION_TERMS_CHANGED_MESSAGE =
    "The subscription terms changed. Review them and try again.";

/** The renewal terms the session shows next to the submit button, if it starts or pays a subscription. */
export function subscriptionTerms(session: ConsentCheckoutSession | undefined): string | null {
    return session?.subscription_terms ?? null;
}

/** The ACH debit authorization shown where the customer enters a bank account to save. */
export function mandateText(
    session: ConsentCheckoutSession | undefined,
    accountHolderType: AccountHolderType = "individual",
): string | null {
    return (
        (accountHolderType === "company" ? session?.company_mandate_text : session?.mandate_text) ??
        null
    );
}

/**
 * Whether a payment through the session saves its payment method for later payments: always in
 * `subscription` and `setup` mode, and on a subscription's invoice while it shows renewal terms,
 * since paying agrees to them. Mirrors the server's rule, which only accepts `mandate_data` for a
 * bank account the payment saves.
 */
export function paymentSavesPaymentMethod(session: ConsentCheckoutSession | undefined): boolean {
    if (!session) return false;
    return session.mode !== "payment" || subscriptionTerms(session) !== null;
}

/** The debit authorization a bank account payment confirms, when it saves the account. */
export function bankAccountMandate(
    session: ConsentCheckoutSession | undefined,
    accountHolderType: AccountHolderType = "individual",
): Pick<PaymentCreateParams, "mandate_data"> {
    return paymentSavesPaymentMethod(session) && mandateText(session, accountHolderType)
        ? { mandate_data: { customer_acceptance: { type: "online" } } }
        : {};
}
