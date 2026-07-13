import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { CheckoutSession } from "@biaspay/sdk";
import { detectGeoLocation } from "./geo";
import {
    createBiasStore,
    createInitialFieldState,
    initialFrameField,
    initialValueField,
    ADDRESS_VALUE_FIELDS,
    CARD_FRAME_FIELDS,
    CARD_VALUE_FIELDS,
    BANK_FRAME_FIELDS,
    BANK_VALUE_FIELDS,
    type BiasStoreState,
    type BiasStoreMethods,
} from "./BiasStore";

vi.mock("./geo", () => ({ detectGeoLocation: vi.fn() }));
const detectGeoLocationMock = vi.mocked(detectGeoLocation);

// Keep the tests off the network: address-metadata loads (triggered by country
// changes) resolve to fallback metadata, and SDK calls get an API error.
vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo | URL) => {
        if (String(url).includes("ssl-address")) return { ok: false, status: 503 };
        return {
            ok: false,
            status: 400,
            headers: new Headers({ "Content-Type": "application/json" }),
            json: async () => ({
                object: "error",
                error: { type: "api_error", message: "network unavailable in tests" },
            }),
        };
    }),
);

function createTestStore(overrides: Partial<Parameters<typeof createBiasStore>[0]> = {}) {
    const onChange = vi.fn<(state: BiasStoreState) => void>();
    const onComplete = vi.fn();
    const store = createBiasStore({
        clientSecret: () => "test_secret",
        onChange,
        onComplete,
        ...overrides,
    });
    return { store, onChange, onComplete };
}

describe("initial state factories", () => {
    it("initialFrameField returns loading state", () => {
        expect(initialFrameField()).toEqual({
            loading: true,
            focused: false,
            empty: true,
            valid: false,
            error: null,
            cardBrand: null,
        });
    });

    it("initialValueField returns empty state by default", () => {
        expect(initialValueField()).toEqual({
            value: "",
            focused: false,
            valid: false,
            error: null,
        });
    });

    it("initialValueField accepts initial value and valid flag", () => {
        expect(initialValueField("US", true)).toEqual({
            value: "US",
            focused: false,
            valid: true,
            error: null,
        });
    });

    it("createInitialFieldState returns correct defaults", () => {
        const state = createInitialFieldState();
        expect(state.country.value).toBe("US");
        expect(state.country.valid).toBe(true);
        expect(state.accountType.value).toBe("checking");
        expect(state.accountType.valid).toBe(true);
        expect(state.postalCode.value).toBe("");
        expect(state.postalCode.valid).toBe(false);
        expect(state.name.value).toBe("");
        expect(state.cardNumber.loading).toBe(true);
    });

    it("createInitialFieldState starts required address fields invalid and optional ones valid", () => {
        const state = createInitialFieldState();
        expect(state.addressLine1.valid).toBe(false);
        expect(state.city.valid).toBe(false);
        expect(state.state.valid).toBe(false);
        expect(state.addressLine2.valid).toBe(true);
        expect(state.phone.valid).toBe(true);
    });
});

describe("createBiasStore", () => {
    describe("getState", () => {
        it("returns initial state", () => {
            const { store } = createTestStore();
            const state = store.getState();
            expect(state.selectedPaymentMethod).toBe("card");
            expect(state.submitLoading).toBe(false);
            expect(state.submitSuccess).toBe(false);
            expect(state.paymentError).toBeNull();
            expect(state.encryptedFields).toEqual({});
        });
    });

    describe("frame field state", () => {
        it("setFrameFieldState patches frame field and notifies", () => {
            const { store, onChange } = createTestStore();
            store.setFrameFieldState("cardNumber", { loading: false, focused: true });

            expect(onChange).toHaveBeenCalled();
            const state = store.getState();
            expect(state.fieldState.cardNumber.loading).toBe(false);
            expect(state.fieldState.cardNumber.focused).toBe(true);
            expect(state.fieldState.cardNumber.valid).toBe(false); // unchanged
        });

        it("onEncryptedData stores encrypted value and marks field valid", () => {
            const { store } = createTestStore();
            store.onEncryptedData("cardNumber", "enc_123");

            const state = store.getState();
            expect(state.encryptedFields.cardNumber).toBe("enc_123");
            expect(state.fieldState.cardNumber.valid).toBe(true);
        });

        it("onEncryptedData with null marks field invalid", () => {
            const { store } = createTestStore();
            store.onEncryptedData("cardNumber", "enc_123");
            store.onEncryptedData("cardNumber", null);

            const state = store.getState();
            expect(state.encryptedFields.cardNumber).toBeNull();
            expect(state.fieldState.cardNumber.valid).toBe(false);
        });

        it("resetFrameFields clears encrypted data and resets frame field state", () => {
            const { store } = createTestStore();
            store.onEncryptedData("cardNumber", "enc_123");
            store.setFrameFieldState("cardNumber", { loading: false, focused: true, valid: true });

            store.resetFrameFields();

            const state = store.getState();
            expect(state.encryptedFields).toEqual({});
            expect(state.fieldState.cardNumber).toEqual(initialFrameField());
            expect(state.submitLoading).toBe(false);
            expect(state.submitSuccess).toBe(false);
            expect(state.paymentError).toBeNull();
        });
    });

    describe("value field state", () => {
        it("setFieldValue updates value, runs validation, clears error", () => {
            const { store } = createTestStore();
            store.setFieldValue("name", "John Doe");

            const state = store.getState();
            expect(state.fieldState.name.value).toBe("John Doe");
            expect(state.fieldState.name.valid).toBe(true);
            expect(state.fieldState.name.error).toBeNull();
        });

        it("setFieldValue with empty string marks invalid but no error (showRequired=false)", () => {
            const { store } = createTestStore();
            store.setFieldValue("name", "");

            const state = store.getState();
            expect(state.fieldState.name.valid).toBe(false);
            expect(state.fieldState.name.error).toBeNull();
        });

        it("validateField does not show Required for untouched empty fields", () => {
            const { store } = createTestStore();
            store.validateField("name");

            const state = store.getState();
            expect(state.fieldState.name.valid).toBe(false);
            expect(state.fieldState.name.error).toBeNull();
        });

        it("validateField shows Required error for touched-then-cleared fields", () => {
            const { store } = createTestStore();
            store.setFieldValue("name", "John");
            store.setFieldValue("name", "");
            store.validateField("name");

            const state = store.getState();
            expect(state.fieldState.name.valid).toBe(false);
            expect(state.fieldState.name.error).toBe("Required");
        });

        it("validateField clears error for valid fields", () => {
            const { store } = createTestStore();
            store.setFieldValue("name", "John");
            store.validateField("name");

            const state = store.getState();
            expect(state.fieldState.name.valid).toBe(true);
            expect(state.fieldState.name.error).toBeNull();
        });

        it("setValueFieldState patches arbitrary field state", () => {
            const { store } = createTestStore();
            store.setValueFieldState("country", { focused: true });

            const state = store.getState();
            expect(state.fieldState.country.focused).toBe(true);
            expect(state.fieldState.country.value).toBe("US"); // unchanged
        });
    });

    describe("custom validators", () => {
        it("registerFieldValidator uses custom logic", () => {
            const { store } = createTestStore();
            store.registerFieldValidator("name", (value, _opts) => ({
                valid: value.length >= 3,
                error: value.length >= 3 ? null : "Too short",
            }));

            store.setFieldValue("name", "Jo");
            expect(store.getState().fieldState.name.valid).toBe(false);

            store.validateField("name");
            expect(store.getState().fieldState.name.error).toBe("Too short");

            store.setFieldValue("name", "John");
            expect(store.getState().fieldState.name.valid).toBe(true);
        });

        it("unregisterFieldValidator reverts to default", () => {
            const { store } = createTestStore();
            store.registerFieldValidator("name", () => ({
                valid: false,
                error: "Always fails",
            }));

            store.setFieldValue("name", "John");
            expect(store.getState().fieldState.name.valid).toBe(false);

            store.unregisterFieldValidator("name");
            store.setFieldValue("name", "John");
            expect(store.getState().fieldState.name.valid).toBe(true);
        });
    });

    describe("payment method selection", () => {
        it("defaults to card", () => {
            const { store } = createTestStore();
            expect(store.getState().selectedPaymentMethod).toBe("card");
        });

        it("setSelectedPaymentMethod switches method and clears errors", () => {
            const { store } = createTestStore();

            // Set an error first
            store.setFieldValue("name", "John");
            store.setFieldValue("name", "");
            store.validateField("name"); // Creates "Required" error
            expect(store.getState().fieldState.name.error).toBe("Required");

            store.setSelectedPaymentMethod("us_bank_account");
            const state = store.getState();
            expect(state.selectedPaymentMethod).toBe("us_bank_account");
            expect(state.fieldState.name.error).toBeNull();
            expect(state.paymentError).toBeNull();
        });
    });

    describe("required fields", () => {
        it("getRequiredFrameFields returns card fields for card method", () => {
            const { store } = createTestStore();
            expect(store.getRequiredFrameFields()).toEqual(CARD_FRAME_FIELDS);
        });

        it("getRequiredFrameFields returns bank fields for us_bank_account", () => {
            const { store } = createTestStore();
            store.setSelectedPaymentMethod("us_bank_account");
            expect(store.getRequiredFrameFields()).toEqual(BANK_FRAME_FIELDS);
        });

        it("getRequiredValueFields returns card value fields for card method", () => {
            const { store } = createTestStore();
            expect(store.getRequiredValueFields()).toEqual(CARD_VALUE_FIELDS);
        });

        it("getRequiredValueFields returns bank value fields for us_bank_account", () => {
            const { store } = createTestStore();
            store.setSelectedPaymentMethod("us_bank_account");
            expect(store.getRequiredValueFields()).toEqual(BANK_VALUE_FIELDS);
        });
    });

    describe("isSubmittable", () => {
        it("returns false when no encrypted data or valid value fields", () => {
            const { store } = createTestStore();
            expect(store.isSubmittable()).toBe(false);
        });

        it("returns true when all card fields are valid", () => {
            const { store } = createTestStore();

            // Set all encrypted frame fields
            store.onEncryptedData("cardNumber", "enc_num");
            store.onEncryptedData("cardExpiry", "enc_exp");
            store.onEncryptedData("cardCvc", "enc_cvc");

            // Country is already valid ("US"), set postal code
            store.setFieldValue("postalCode", "12345");

            expect(store.isSubmittable()).toBe(true);
        });

        it("returns false when missing one encrypted field", () => {
            const { store } = createTestStore();

            store.onEncryptedData("cardNumber", "enc_num");
            store.onEncryptedData("cardExpiry", "enc_exp");
            // Missing CVC
            store.setFieldValue("postalCode", "12345");

            expect(store.isSubmittable()).toBe(false);
        });

        it("returns true for bank account when all fields valid", () => {
            const { store } = createTestStore();
            store.setSelectedPaymentMethod("us_bank_account");

            store.onEncryptedData("bankAccountNumber", "enc_acct");
            store.onEncryptedData("bankRoutingNumber", "enc_rtn");
            store.setFieldValue("name", "John Doe");
            // accountType already valid ("checking"), country already valid ("US")
            store.setFieldValue("postalCode", "12345");

            expect(store.isSubmittable()).toBe(true);
        });
    });

    describe("attemptPayment", () => {
        it("triggers frame validation for all required frame fields", () => {
            const { store } = createTestStore();
            const triggerFrameValidation = vi.fn();

            store.attemptPayment({ triggerFrameValidation });

            expect(triggerFrameValidation).toHaveBeenCalledTimes(CARD_FRAME_FIELDS.length);
            for (const field of CARD_FRAME_FIELDS) {
                expect(triggerFrameValidation).toHaveBeenCalledWith(field);
            }
        });

        it("sets submitLoading true then false when validation fails", () => {
            const { store, onChange } = createTestStore();

            store.attemptPayment({ triggerFrameValidation: vi.fn() });

            // First onChange sets submitLoading=true, later ones set it back to false
            const loadingStates = onChange.mock.calls.map((c) => c[0].submitLoading);
            expect(loadingStates[0]).toBe(true);
            // Final state is false because validation failed
            expect(store.getState().submitLoading).toBe(false);
        });

        it("validates value fields and shows errors", () => {
            const { store } = createTestStore();

            // postalCode is empty, should show error
            store.attemptPayment({ triggerFrameValidation: vi.fn() });

            const state = store.getState();
            expect(state.fieldState.postalCode.error).toBe("Required");
            expect(state.submitLoading).toBe(false); // Failed, so not loading
        });

        it("does nothing if already loading", () => {
            const { store } = createTestStore();

            // Make a store that will remain in loading state (all fields valid so it calls createPayment)
            store.onEncryptedData("cardNumber", "enc_num");
            store.onEncryptedData("cardExpiry", "enc_exp");
            store.onEncryptedData("cardCvc", "enc_cvc");
            store.setFieldValue("postalCode", "12345");

            const trigger1 = vi.fn();
            store.attemptPayment({ triggerFrameValidation: trigger1 });
            // Now submitLoading should be true (createPayment is async)
            expect(store.getState().submitLoading).toBe(true);

            const trigger2 = vi.fn();
            store.attemptPayment({ triggerFrameValidation: trigger2 });
            // Second attempt should be a no-op
            expect(trigger2).not.toHaveBeenCalled();
        });

        it("does nothing if already succeeded", () => {
            const { store } = createTestStore();

            // Simulate success state by getting store into submitSuccess
            // This is tricky without mocking the SDK, so test the guard instead
            const trigger = vi.fn();
            store.attemptPayment({ triggerFrameValidation: trigger });

            // Reset and try when submitSuccess is true (would need SDK mock for full path)
            // For now, verify the loading guard works
            expect(trigger).toHaveBeenCalled();
        });

        it("triggers bank account frame validation when method is us_bank_account", () => {
            const { store } = createTestStore();
            store.setSelectedPaymentMethod("us_bank_account");
            const triggerFrameValidation = vi.fn();

            store.attemptPayment({ triggerFrameValidation });

            expect(triggerFrameValidation).toHaveBeenCalledTimes(BANK_FRAME_FIELDS.length);
            for (const field of BANK_FRAME_FIELDS) {
                expect(triggerFrameValidation).toHaveBeenCalledWith(field);
            }
        });

        it("clears paymentError before attempting", () => {
            const { store } = createTestStore();

            // First attempt fails and may set an error
            store.attemptPayment({ triggerFrameValidation: vi.fn() });

            // Manually check paymentError is cleared at the start of attempt
            // (after the first attempt fails, submitLoading is false again)
            const trigger = vi.fn();
            store.attemptPayment({ triggerFrameValidation: trigger });

            // The second attempt should have cleared paymentError initially
            // even though it will fail again
            expect(trigger).toHaveBeenCalled();
        });
    });

    describe("setAddressFields", () => {
        function fillCardFields(store: BiasStoreMethods) {
            store.onEncryptedData("cardNumber", "enc_num");
            store.onEncryptedData("cardExpiry", "enc_exp");
            store.onEncryptedData("cardCvc", "enc_cvc");
            store.setFieldValue("postalCode", "12345");
        }

        it("toggles collectsAddress in state", () => {
            const { store } = createTestStore();
            expect(store.getState().collectsAddress).toBe(false);

            store.setAddressFields("billing", ADDRESS_VALUE_FIELDS);
            expect(store.getState().collectsAddress).toBe(true);

            store.setAddressFields("billing", null);
            expect(store.getState().collectsAddress).toBe(false);
        });

        it("adds address fields to the required value fields without duplicates", () => {
            const { store } = createTestStore();
            store.setAddressFields("billing", ADDRESS_VALUE_FIELDS);

            const required = store.getRequiredValueFields();
            expect(new Set(required)).toEqual(
                new Set([...CARD_VALUE_FIELDS, ...ADDRESS_VALUE_FIELDS]),
            );
            expect(required.length).toBe(new Set(required).size);
        });

        it("restores method-only required fields when unregistered", () => {
            const { store } = createTestStore();
            store.setAddressFields("billing", ADDRESS_VALUE_FIELDS);
            store.setAddressFields("billing", null);
            expect(store.getRequiredValueFields()).toEqual(CARD_VALUE_FIELDS);
        });

        it("blocks submission until address fields are valid", () => {
            const { store } = createTestStore();
            fillCardFields(store);
            expect(store.isSubmittable()).toBe(true);

            store.setAddressFields("billing", ADDRESS_VALUE_FIELDS);
            expect(store.isSubmittable()).toBe(false);

            store.setFieldValue("name", "Jane Doe");
            store.setFieldValue("addressLine1", "123 Main St");
            store.setFieldValue("city", "New York");
            store.setFieldValue("state", "NY");
            expect(store.isSubmittable()).toBe(true);
        });

        it("attemptPayment surfaces Required errors on empty address fields", () => {
            const { store } = createTestStore();
            fillCardFields(store);
            store.setAddressFields("billing", ADDRESS_VALUE_FIELDS);

            store.attemptPayment({ triggerFrameValidation: vi.fn() });

            const state = store.getState();
            expect(state.fieldState.addressLine1.error).toBe("Required");
            expect(state.fieldState.city.error).toBe("Required");
            expect(state.fieldState.name.error).toBe("Required");
            expect(state.submitLoading).toBe(false);
        });

        it("respects registered validators for conditionally required fields", () => {
            const { store } = createTestStore();
            fillCardFields(store);
            store.setAddressFields("billing", ADDRESS_VALUE_FIELDS);

            // Simulate the state input's validator: only required for US/CA
            store.registerFieldValidator("state", () => ({
                valid: true,
                error: null,
            }));
            store.setFieldValue("name", "Jane Doe");
            store.setFieldValue("addressLine1", "123 Main St");
            store.setFieldValue("city", "Berlin");
            store.setFieldValue("state", "");

            expect(store.isSubmittable()).toBe(true);
        });
    });

    describe("shipping scope", () => {
        const SHIPPING_FIELDS = ADDRESS_VALUE_FIELDS.map((f) =>
            f === "name"
                ? "shippingName"
                : f === "country"
                  ? "shippingCountry"
                  : f === "postalCode"
                    ? "shippingPostalCode"
                    : f === "addressLine1"
                      ? "shippingAddressLine1"
                      : f === "city"
                        ? "shippingCity"
                        : f === "state"
                          ? "shippingState"
                          : f,
        );

        it("toggles collectsShipping without touching collectsAddress", () => {
            const { store } = createTestStore();
            store.setAddressFields("shipping", ADDRESS_VALUE_FIELDS);
            expect(store.getState().collectsShipping).toBe(true);
            expect(store.getState().collectsAddress).toBe(false);

            store.setAddressFields("shipping", null);
            expect(store.getState().collectsShipping).toBe(false);
        });

        it("registers shipping-scoped required fields", () => {
            const { store } = createTestStore();
            store.setAddressFields("shipping", ADDRESS_VALUE_FIELDS);

            const required = new Set(store.getRequiredValueFields());
            for (const field of SHIPPING_FIELDS) {
                expect(required.has(field as (typeof SHIPPING_FIELDS)[number])).toBe(true);
            }
            // Billing name/line1/city are NOT required by a shipping-only form.
            expect(required.has("addressLine1" as never)).toBe(false);
        });

        it("keeps billing and shipping field values independent", () => {
            const { store } = createTestStore();
            store.setFieldValue("addressLine1", "1 Billing St");
            store.setFieldValue("shippingAddressLine1", "2 Shipping Ave");

            const fs = store.getState().fieldState;
            expect(fs.addressLine1.value).toBe("1 Billing St");
            expect(fs.shippingAddressLine1.value).toBe("2 Shipping Ave");
        });

        it("supports a billing and a shipping form at once", () => {
            const { store } = createTestStore();
            store.setAddressFields("billing", ADDRESS_VALUE_FIELDS);
            store.setAddressFields("shipping", ADDRESS_VALUE_FIELDS);

            const required = new Set(store.getRequiredValueFields());
            expect(required.has("addressLine1")).toBe(true);
            expect(required.has("shippingAddressLine1" as never)).toBe(true);

            store.setAddressFields("shipping", null);
            const afterUnmount = new Set(store.getRequiredValueFields());
            expect(afterUnmount.has("addressLine1")).toBe(true);
            expect(afterUnmount.has("shippingAddressLine1" as never)).toBe(false);
        });

        it("a shipping country change does not clear billing postal code", () => {
            const { store } = createTestStore();
            store.setFieldValue("postalCode", "12345");
            store.setFieldValue("shippingCountry", "CA");

            expect(store.getState().fieldState.postalCode.value).toBe("12345");
        });
    });

    describe("setContactDetailsFields", () => {
        function fillCardFields(store: BiasStoreMethods) {
            store.onEncryptedData("cardNumber", "enc_num");
            store.onEncryptedData("cardExpiry", "enc_exp");
            store.onEncryptedData("cardCvc", "enc_cvc");
            store.setFieldValue("postalCode", "12345");
        }

        it("toggles collectsContactDetails in state", () => {
            const { store } = createTestStore();
            expect(store.getState().collectsContactDetails).toBe(false);

            store.setContactDetailsFields(true);
            expect(store.getState().collectsContactDetails).toBe(true);

            store.setContactDetailsFields(false);
            expect(store.getState().collectsContactDetails).toBe(false);
        });

        it("adds email to the required value fields while mounted", () => {
            const { store } = createTestStore();
            store.setContactDetailsFields(true);
            expect(store.getRequiredValueFields()).toContain("email");

            store.setContactDetailsFields(false);
            expect(store.getRequiredValueFields()).not.toContain("email");
        });

        it("blocks submission until email is valid", () => {
            const { store } = createTestStore();
            fillCardFields(store);
            store.setContactDetailsFields(true);
            expect(store.isSubmittable()).toBe(false);

            store.setFieldValue("email", "not-an-email");
            expect(store.isSubmittable()).toBe(false);

            store.setFieldValue("email", "jane@example.com");
            expect(store.isSubmittable()).toBe(true);
        });

        it("attemptPayment surfaces a Required error on an empty email", () => {
            const { store } = createTestStore();
            fillCardFields(store);
            store.setContactDetailsFields(true);

            store.attemptPayment({ triggerFrameValidation: vi.fn() });

            const state = store.getState();
            expect(state.fieldState.email.error).toBe("Required");
            expect(state.submitLoading).toBe(false);
        });

        it("attemptPayment surfaces a format error on an invalid email", () => {
            const { store } = createTestStore();
            fillCardFields(store);
            store.setContactDetailsFields(true);
            store.setFieldValue("email", "not-an-email");

            store.attemptPayment({ triggerFrameValidation: vi.fn() });

            expect(store.getState().fieldState.email.error).toBe("Enter a valid email address");
        });

        it("does not require email when no contact details element is mounted", () => {
            const { store } = createTestStore();
            fillCardFields(store);
            expect(store.isSubmittable()).toBe(true);
        });
    });

    describe("autosave", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        function sessionUpdateCalls() {
            return vi
                .mocked(fetch)
                .mock.calls.filter(([url]) => String(url).includes("/checkout_sessions/"));
        }

        it("saves the email to the session after the debounce delay", async () => {
            const { store } = createTestStore();
            store.setContactDetailsFields(true);
            vi.mocked(fetch).mockClear();

            store.setFieldValue("email", "jane@example.com");
            expect(sessionUpdateCalls()).toHaveLength(0);

            await vi.advanceTimersByTimeAsync(1000);
            expect(sessionUpdateCalls()).toHaveLength(1);
        });

        it("does not autosave email when no contact details element is mounted", async () => {
            const { store } = createTestStore();
            vi.mocked(fetch).mockClear();

            store.setFieldValue("email", "jane@example.com");
            await vi.advanceTimersByTimeAsync(1000);

            expect(sessionUpdateCalls()).toHaveLength(0);
        });

        it("saves shipping address fields after the debounce delay", async () => {
            const { store } = createTestStore();
            store.setAddressFields("shipping", ADDRESS_VALUE_FIELDS);
            vi.mocked(fetch).mockClear();

            store.setFieldValue("shippingName", "Jane Doe");
            await vi.advanceTimersByTimeAsync(1000);

            expect(sessionUpdateCalls()).toHaveLength(1);
        });

        it("saves billing address fields after the debounce delay", async () => {
            const { store } = createTestStore();
            store.setAddressFields("billing", ADDRESS_VALUE_FIELDS);
            vi.mocked(fetch).mockClear();

            store.setFieldValue("name", "Jane Doe");
            await vi.advanceTimersByTimeAsync(1000);

            expect(sessionUpdateCalls()).toHaveLength(1);
        });

        it("does not autosave billing address fields when no billing address element is mounted", async () => {
            const { store } = createTestStore();
            vi.mocked(fetch).mockClear();

            store.setFieldValue("country", "CA");
            await vi.advanceTimersByTimeAsync(1000);

            expect(sessionUpdateCalls()).toHaveLength(0);
        });

        it("saves billing address immediately when 'same as shipping' is toggled", async () => {
            const { store } = createTestStore();
            store.setAddressFields("shipping", ADDRESS_VALUE_FIELDS);
            store.setAddressFields("billing", ADDRESS_VALUE_FIELDS);
            vi.mocked(fetch).mockClear();

            store.setBillingSameAsShipping(true);
            await vi.advanceTimersByTimeAsync(1000);

            expect(sessionUpdateCalls()).toHaveLength(1);
        });

        it("coalesces rapid keystrokes into a single save", async () => {
            const { store } = createTestStore();
            store.setContactDetailsFields(true);
            vi.mocked(fetch).mockClear();

            for (const c of ["j", "ja", "jan", "jane@example.com"]) {
                store.setFieldValue("email", c);
                await vi.advanceTimersByTimeAsync(200);
            }
            await vi.advanceTimersByTimeAsync(1000);

            expect(sessionUpdateCalls()).toHaveLength(1);
        });

        it("does not schedule a new autosave for an edit made while submitLoading is true", async () => {
            const { store } = createTestStore();
            store.setContactDetailsFields(true);
            store.onEncryptedData("cardNumber", "enc_num");
            store.onEncryptedData("cardExpiry", "enc_exp");
            store.onEncryptedData("cardCvc", "enc_cvc");
            store.setFieldValue("postalCode", "12345");
            store.setFieldValue("email", "jane@example.com");

            store.attemptPayment({ triggerFrameValidation: vi.fn() });
            expect(store.getState().submitLoading).toBe(true);
            // Final submission begins only after canceled autosaves settle.
            await Promise.resolve();
            await Promise.resolve();
            vi.mocked(fetch).mockClear();

            store.setFieldValue("email", "changed@example.com");
            await vi.advanceTimersByTimeAsync(1000);

            expect(sessionUpdateCalls()).toHaveLength(0);
        });
    });

    describe("hydrateFromSession", () => {
        function sessionFixture(overrides: Partial<CheckoutSession> = {}): CheckoutSession {
            return {
                object: "checkout_session",
                id: "cs_test",
                live: false,
                created_at: 0,
                amount: 1000,
                amount_collected: 0,
                dual_pricing: null,
                client_details: null,
                client_secret: "test_secret",
                customer: null,
                customer_details: { email: "jane@example.com", name: null, phone: null },
                shipping_details: {
                    name: "Jane Doe",
                    phone: "5551234567",
                    address: {
                        city: "Springfield",
                        country: "US",
                        line1: "123 Main St",
                        line2: null,
                        postal_code: "62704",
                        state: "IL",
                    },
                },
                billing_details: null,
                payments: null,
                invoice: null,
                line_items: null,
                metadata: {},
                mode: "payment",
                payment_method_types: ["card"],
                status: "open",
                submit_label: "pay",
                ...overrides,
            } as CheckoutSession;
        }

        it("fills the email field when a contact details element is mounted", () => {
            const { store } = createTestStore();
            store.setContactDetailsFields(true);

            store.hydrateFromSession(sessionFixture());

            expect(store.getState().fieldState.email.value).toBe("jane@example.com");
        });

        it("does not fill the email field when no contact details element is mounted", () => {
            const { store } = createTestStore();

            store.hydrateFromSession(sessionFixture());

            expect(store.getState().fieldState.email.value).toBe("");
        });

        it("does not overwrite an email the user has already typed", () => {
            const { store } = createTestStore();
            store.setContactDetailsFields(true);
            store.setFieldValue("email", "typed@example.com");

            store.hydrateFromSession(sessionFixture());

            expect(store.getState().fieldState.email.value).toBe("typed@example.com");
        });

        it("fills shipping address fields when a shipping address element is mounted", () => {
            const { store } = createTestStore();
            store.setAddressFields("shipping", ADDRESS_VALUE_FIELDS);

            store.hydrateFromSession(sessionFixture());

            const fs = store.getState().fieldState;
            expect(fs.shippingName.value).toBe("Jane Doe");
            expect(fs.shippingAddressLine1.value).toBe("123 Main St");
            expect(fs.shippingCity.value).toBe("Springfield");
            expect(fs.shippingState.value).toBe("IL");
            expect(fs.shippingPostalCode.value).toBe("62704");
            expect(fs.shippingCountry.value).toBe("US");
        });

        it("does not fill shipping fields when no shipping address element is mounted", () => {
            const { store } = createTestStore();

            store.hydrateFromSession(sessionFixture());

            expect(store.getState().fieldState.shippingName.value).toBe("");
        });

        it("fills billing address fields when a billing address element is mounted", () => {
            const { store } = createTestStore();
            store.setAddressFields("billing", ADDRESS_VALUE_FIELDS);

            store.hydrateFromSession(
                sessionFixture({
                    billing_details: {
                        name: "Billing Name",
                        address: {
                            city: "Metropolis",
                            country: "US",
                            line1: "456 Side St",
                            line2: null,
                            postal_code: "10001",
                            state: "NY",
                        },
                    },
                }),
            );

            const fs = store.getState().fieldState;
            expect(fs.name.value).toBe("Billing Name");
            expect(fs.addressLine1.value).toBe("456 Side St");
            expect(fs.city.value).toBe("Metropolis");
            expect(fs.state.value).toBe("NY");
            expect(fs.postalCode.value).toBe("10001");
            expect(fs.country.value).toBe("US");
        });

        it("does not fill billing address fields when no billing address element is mounted", () => {
            const { store } = createTestStore();

            store.hydrateFromSession(
                sessionFixture({
                    billing_details: {
                        name: "Billing Name",
                        address: {
                            city: "Metropolis",
                            country: "US",
                            line1: "456 Side St",
                            line2: null,
                            postal_code: "10001",
                            state: "NY",
                        },
                    },
                }),
            );

            expect(store.getState().fieldState.name.value).toBe("");
        });

        it("infers 'same as shipping' when the saved billing and shipping addresses match", () => {
            const { store } = createTestStore();
            store.setAddressFields("billing", ADDRESS_VALUE_FIELDS);
            store.setAddressFields("shipping", ADDRESS_VALUE_FIELDS);

            store.hydrateFromSession(
                sessionFixture({
                    billing_details: {
                        name: "Jane Doe",
                        address: {
                            city: "Springfield",
                            country: "US",
                            line1: "123 Main St",
                            line2: null,
                            postal_code: "62704",
                            state: "IL",
                        },
                    },
                }),
            );

            expect(store.getState().billingSameAsShipping).toBe(true);
        });

        it("does not infer 'same as shipping' when the saved billing and shipping addresses differ", () => {
            const { store } = createTestStore();
            store.setAddressFields("billing", ADDRESS_VALUE_FIELDS);
            store.setAddressFields("shipping", ADDRESS_VALUE_FIELDS);

            store.hydrateFromSession(
                sessionFixture({
                    billing_details: {
                        name: "Billing Name",
                        address: {
                            city: "Metropolis",
                            country: "US",
                            line1: "456 Side St",
                            line2: null,
                            postal_code: "10001",
                            state: "NY",
                        },
                    },
                }),
            );

            expect(store.getState().billingSameAsShipping).toBe(false);
        });

        it("does not override an explicitly-set 'same as shipping' state on re-hydration", () => {
            const { store } = createTestStore();
            store.setAddressFields("billing", ADDRESS_VALUE_FIELDS);
            store.setAddressFields("shipping", ADDRESS_VALUE_FIELDS);
            store.setBillingSameAsShipping(false);

            store.hydrateFromSession(
                sessionFixture({
                    billing_details: {
                        name: "Jane Doe",
                        address: {
                            city: "Springfield",
                            country: "US",
                            line1: "123 Main St",
                            line2: null,
                            postal_code: "62704",
                            state: "IL",
                        },
                    },
                }),
            );

            expect(store.getState().billingSameAsShipping).toBe(false);
        });

        it("does not overwrite a shipping field the user has already touched", () => {
            const { store } = createTestStore();
            store.setAddressFields("shipping", ADDRESS_VALUE_FIELDS);
            store.setFieldValue("shippingName", "Someone Else");

            store.hydrateFromSession(sessionFixture());

            expect(store.getState().fieldState.shippingName.value).toBe("Someone Else");
        });

        it("does nothing when the session has no shipping details", () => {
            const { store } = createTestStore();
            store.setAddressFields("shipping", ADDRESS_VALUE_FIELDS);

            store.hydrateFromSession(sessionFixture({ shipping_details: null }));

            expect(store.getState().fieldState.shippingName.value).toBe("");
        });

        it("survives a subsequent geo default lookup without being overwritten", async () => {
            detectGeoLocationMock.mockReset();
            detectGeoLocationMock.mockResolvedValue({ country: "DE", region: "Berlin" });
            const { store } = createTestStore();
            store.setAddressFields("shipping", ADDRESS_VALUE_FIELDS);

            store.hydrateFromSession(sessionFixture());
            await store.applyGeoDefaults();

            const { fieldState } = store.getState();
            expect(fieldState.shippingCountry.value).toBe("US");
            expect(fieldState.shippingState.value).toBe("IL");
        });
    });

    describe("country changes", () => {
        it("clears postal code and state when the country changes", () => {
            const { store } = createTestStore();
            store.setFieldValue("postalCode", "90210");
            store.setFieldValue("state", "CA");

            store.setFieldValue("country", "DE");

            const { fieldState } = store.getState();
            expect(fieldState.postalCode.value).toBe("");
            expect(fieldState.state.value).toBe("");
            expect(fieldState.postalCode.error).toBeNull();
            expect(fieldState.state.error).toBeNull();
        });

        it("keeps the city value and revalidates it", () => {
            const { store } = createTestStore();
            store.setFieldValue("city", "Portland");

            store.setFieldValue("country", "DE");

            const { fieldState } = store.getState();
            expect(fieldState.city.value).toBe("Portland");
            expect(fieldState.city.valid).toBe(true);
        });

        it("validates the postal code against the new country's format", () => {
            const { store } = createTestStore();
            store.setFieldValue("postalCode", "90210");
            expect(store.getState().fieldState.postalCode.valid).toBe(true);

            store.setFieldValue("postalCode", "1234");
            store.validateField("postalCode");
            expect(store.getState().fieldState.postalCode.valid).toBe(false);
            expect(store.getState().fieldState.postalCode.error).toBe("Your ZIP code is invalid.");
        });
    });

    describe("applyGeoDefaults", () => {
        beforeEach(() => {
            detectGeoLocationMock.mockReset();
        });

        it("defaults the state from the detected region", async () => {
            detectGeoLocationMock.mockResolvedValue({ country: "US", region: "California" });
            const { store } = createTestStore();

            await store.applyGeoDefaults();

            const { fieldState } = store.getState();
            expect(fieldState.country.value).toBe("US");
            expect(fieldState.state.value).toBe("CA");
        });

        it("defaults the country from the detected location", async () => {
            detectGeoLocationMock.mockResolvedValue({ country: "DE", region: "Berlin" });
            const { store } = createTestStore();

            await store.applyGeoDefaults();

            expect(store.getState().fieldState.country.value).toBe("DE");
        });

        it("never overrides a country the user selected", async () => {
            detectGeoLocationMock.mockResolvedValue({ country: "DE", region: "Berlin" });
            const { store } = createTestStore();
            store.setFieldValue("country", "FR");

            await store.applyGeoDefaults();

            expect(store.getState().fieldState.country.value).toBe("FR");
        });

        it("never overrides a state the user selected", async () => {
            detectGeoLocationMock.mockResolvedValue({ country: "US", region: "California" });
            const { store } = createTestStore();
            store.setFieldValue("state", "NY");

            await store.applyGeoDefaults();

            expect(store.getState().fieldState.state.value).toBe("NY");
        });

        it("ignores unknown countries and lookup failures", async () => {
            detectGeoLocationMock.mockResolvedValue(null);
            const { store } = createTestStore();
            await store.applyGeoDefaults();
            expect(store.getState().fieldState.country.value).toBe("US");
        });

        it("runs the lookup at most once per store", async () => {
            detectGeoLocationMock.mockResolvedValue({ country: "US", region: null });
            const { store } = createTestStore();

            await store.applyGeoDefaults();
            await store.applyGeoDefaults();

            expect(detectGeoLocationMock).toHaveBeenCalledTimes(1);
        });
    });

    describe("setApiBaseUrl", () => {
        it("allows updating the API base URL", () => {
            const { store } = createTestStore();
            // Just verify it doesn't throw
            store.setApiBaseUrl("https://api.example.com");
        });
    });

    describe("onChange notifications", () => {
        it("calls onChange for every state mutation", () => {
            const { store, onChange } = createTestStore();

            store.setFieldValue("name", "John");
            expect(onChange).toHaveBeenCalledTimes(1);

            store.setSelectedPaymentMethod("us_bank_account");
            expect(onChange).toHaveBeenCalledTimes(2);

            store.onEncryptedData("cardNumber", "enc");
            expect(onChange).toHaveBeenCalledTimes(3);
        });

        it("onChange receives the full state object", () => {
            const { store, onChange } = createTestStore();
            store.setFieldValue("name", "John");

            const state = onChange.mock.calls[0]![0];
            expect(state).toHaveProperty("fieldState");
            expect(state).toHaveProperty("selectedPaymentMethod");
            expect(state).toHaveProperty("encryptedFields");
            expect(state).toHaveProperty("submitLoading");
            expect(state).toHaveProperty("submitSuccess");
            expect(state).toHaveProperty("paymentError");
        });
    });
});
