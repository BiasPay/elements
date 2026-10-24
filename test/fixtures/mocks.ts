import type { CheckoutSession } from "@biaspay/sdk-checkout";

export function createMockSession(overrides: Partial<CheckoutSession> = {}): CheckoutSession {
    return {
        object: "checkout_session",
        id: "cs_test_123",
        live: false,
        created_at: Date.now(),
        updated_at: Date.now(),
        total: 5000,
        amount_collected: 0,
        amount_remaining: 5000,
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
    createMockSession({
        total: 10000,
        amount_remaining: 10000,
        dual_pricing: { rate: 3, amount_remaining: 10300 },
    });
export const createMockMultiMethodSession = () =>
    createMockSession({ payment_method_types: ["card", "us_bank_account"] });
export const createMockSetupSession = () =>
    createMockSession({
        mode: "setup",
        total: 0,
        amount_remaining: 0,
        submit_label: "auto",
    });
