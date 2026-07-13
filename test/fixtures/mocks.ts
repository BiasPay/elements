import type { CheckoutSession } from "@biaspay/sdk";

export function createMockSession(overrides: Partial<CheckoutSession> = {}): CheckoutSession {
    return {
        object: "checkout_session",
        id: "cs_test_123",
        live: false,
        created_at: Date.now(),
        amount: 5000,
        amount_collected: 0,
        currency: "USD",
        dual_pricing: null,
        client_details: null,
        client_secret: "cs_test_secret_123",
        customer: null,
        customer_details: { email: null, name: null, phone: null },
        payments: null,
        invoice: null,
        line_items: null,
        metadata: {},
        mode: "payment",
        payment_method_types: ["card"],
        status: "open",
        submit_label: "pay",
        ...overrides,
    };
}

export const createMockDualPricingSession = () =>
    createMockSession({ amount: 10000, dual_pricing: { rate: 3 } });
export const createMockMultiMethodSession = () =>
    createMockSession({ payment_method_types: ["card", "us_bank_account"] });
export const createMockSetupSession = () =>
    createMockSession({ mode: "setup", amount: 0, submit_label: "auto" });
