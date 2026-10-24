import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADDRESS_VALUE_FIELDS, createBiasStore, type BiasStoreMethods } from "./BiasStore";

const sdk = vi.hoisted(() => ({
    updateSession: vi.fn(),
    createPayment: vi.fn(),
}));

vi.mock("@biaspay/sdk-checkout", () => ({
    Bias: class {
        checkoutSessions = {
            update: (...args: unknown[]) => sdk.updateSession(...args),
        };
        payments = {
            create: (...args: unknown[]) => sdk.createPayment(...args),
        };
    },
}));

vi.mock("./geo", () => ({ detectGeoLocation: vi.fn() }));

function createTestStore() {
    return createBiasStore({
        clientSecret: () => "test_secret",
        onChange: vi.fn(),
    });
}

function registerAddresses(store: BiasStoreMethods) {
    store.setAddressFields("billing", ADDRESS_VALUE_FIELDS);
    store.setAddressFields("shipping", ADDRESS_VALUE_FIELDS);
}

function fillShippingAddress(store: BiasStoreMethods) {
    store.setFieldValue("shippingFirstName", "Shipping");
    store.setFieldValue("shippingLastName", "Name");
    store.setFieldValue("shippingAddressLine1", "123 Main St");
    store.setFieldValue("shippingCity", "Springfield");
    store.setFieldValue("shippingState", "IL");
    store.setFieldValue("shippingPostalCode", "62704");
}

beforeEach(() => {
    vi.useFakeTimers();
    sdk.updateSession.mockReset().mockResolvedValue({
        object: "checkout_session",
        mode: "payment",
        updated_at: 1,
        amount_remaining: 1_000,
        dual_pricing: null,
    });
    sdk.createPayment
        .mockReset()
        .mockResolvedValue({ object: "payment", id: "pay_test", status: "succeeded" });
});

afterEach(() => {
    vi.useRealTimers();
});

describe("billing same as shipping", () => {
    it("requires the visible shipping fields instead of hidden billing fields", () => {
        const store = createTestStore();
        registerAddresses(store);
        store.setBillingSameAsShipping(true);
        fillShippingAddress(store);
        store.onEncryptedData("cardNumber", "enc_num");
        store.onEncryptedData("cardExpiry", "enc_exp");
        store.onEncryptedData("cardCvc", "enc_cvc");

        expect(store.getState().fieldState.firstName.value).toBe("");
        expect(store.getState().fieldState.lastName.value).toBe("");
        expect(store.getState().fieldState.addressLine1.value).toBe("");
        const requiredFields = store.getRequiredValueFields();
        for (const billingField of [
            "firstName",
            "lastName",
            "country",
            "addressLine1",
            "city",
            "state",
            "postalCode",
        ] as const) {
            expect(requiredFields).not.toContain(billingField);
        }
        expect(store.isSubmittable()).toBe(true);

        store.cancel();
    });

    it("uses the shipping name in bank payment billing details", async () => {
        const store = createTestStore();
        registerAddresses(store);
        store.setSelectedPaymentMethod("us_bank_account");
        store.setBillingSameAsShipping(true);
        fillShippingAddress(store);
        store.onEncryptedData("bankAccountNumber", "enc_account");
        store.onEncryptedData("bankRoutingNumber", "enc_routing");

        await vi.advanceTimersByTimeAsync(1000);
        store.attemptPayment({ triggerFrameValidation: vi.fn() });
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(sdk.createPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                payment_method: expect.objectContaining({
                    billing_details: expect.objectContaining({
                        name: "Shipping Name",
                    }),
                }),
            }),
            expect.anything(),
        );
        const bankBillingDetails =
            sdk.createPayment.mock.calls[0]?.[0].payment_method.billing_details;
        expect(bankBillingDetails).not.toHaveProperty("phone");

        store.cancel();
    });

    it("omits phone from card billing details", async () => {
        const store = createTestStore();
        registerAddresses(store);
        store.setBillingSameAsShipping(true);
        fillShippingAddress(store);
        store.onEncryptedData("cardNumber", "enc_num");
        store.onEncryptedData("cardExpiry", "enc_exp");
        store.onEncryptedData("cardCvc", "enc_cvc");

        await vi.advanceTimersByTimeAsync(1000);
        store.attemptPayment({ triggerFrameValidation: vi.fn() });
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const cardBillingDetails =
            sdk.createPayment.mock.calls[0]?.[0].payment_method.billing_details;
        expect(cardBillingDetails).not.toHaveProperty("phone");

        store.cancel();
    });
});

describe("amount pinning", () => {
    function storeShowing(displayed: Record<string, unknown>) {
        const refreshCheckoutSession = vi.fn();
        const store = createBiasStore({
            clientSecret: () => "test_secret",
            onChange: vi.fn(),
            getCheckoutSession: () =>
                ({
                    object: "checkout_session",
                    mode: "payment",
                    dual_pricing: null,
                    ...displayed,
                }) as never,
            refreshCheckoutSession,
        });
        registerAddresses(store);
        store.setBillingSameAsShipping(true);
        fillShippingAddress(store);
        store.onEncryptedData("cardNumber", "enc_num");
        store.onEncryptedData("cardExpiry", "enc_exp");
        store.onEncryptedData("cardCvc", "enc_cvc");
        return { store, refreshCheckoutSession };
    }

    async function submit(store: BiasStoreMethods) {
        await vi.advanceTimersByTimeAsync(1000);
        store.attemptPayment({ triggerFrameValidation: vi.fn() });
        await vi.advanceTimersByTimeAsync(0);
    }

    it("pins the displayed amount remaining and session version", async () => {
        const { store } = storeShowing({ updated_at: 1, amount_remaining: 1_000 });
        await submit(store);
        expect(sdk.createPayment.mock.calls[0]?.[0]).toMatchObject({
            amount: 1_000,
            checkout_session_updated_at: 1,
        });
        store.cancel();
    });

    it("does not charge when a $0 displayed amount becomes chargeable at submit", async () => {
        const { store, refreshCheckoutSession } = storeShowing({
            updated_at: 1,
            amount_remaining: 0,
        });
        sdk.updateSession.mockResolvedValue({
            object: "checkout_session",
            mode: "payment",
            updated_at: 2,
            amount_remaining: 10_000,
            dual_pricing: null,
        });
        await submit(store);
        expect(sdk.createPayment).not.toHaveBeenCalled();
        expect(store.getState().paymentError).toBe(
            "Checkout details changed. Review the updated total and try again.",
        );
        expect(refreshCheckoutSession).toHaveBeenCalled();
        store.cancel();
    });

    it("does not charge when the displayed amount drops to $0 at submit", async () => {
        const { store } = storeShowing({ updated_at: 1, amount_remaining: 1_000 });
        sdk.updateSession.mockResolvedValue({
            object: "checkout_session",
            mode: "payment",
            updated_at: 2,
            amount_remaining: 0,
            dual_pricing: null,
        });
        await submit(store);
        expect(sdk.createPayment).not.toHaveBeenCalled();
        store.cancel();
    });

    it("sends no amount for a setup session", async () => {
        const { store } = storeShowing({ mode: "setup", updated_at: 1, amount_remaining: 0 });
        sdk.updateSession.mockResolvedValue({
            object: "checkout_session",
            mode: "setup",
            updated_at: 1,
            amount_remaining: 0,
            dual_pricing: null,
        });
        await submit(store);
        expect(sdk.createPayment.mock.calls[0]?.[0]).not.toHaveProperty("amount");
        store.cancel();
    });
});
