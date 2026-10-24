import { describe, expect, it, vi } from "vitest";
import type { ElementsController } from "~/core";
import { appearance, mergeAppearance } from "../src/lib/utils/appearance";
import { BiasController } from "../src/lib/context.svelte";
import { trackEffect } from "./reactive-probe.svelte";
import { filterSupportedPaymentMethods } from "../src/lib/components/PaymentMethodList/paymentMethods";

function fakeCore(): ElementsController {
    const unregister = vi.fn();
    return {
        getPublicState: () => ({
            sessionState: { status: "idle" },
            discountCodeState: {
                pendingAction: null,
                error: null,
                blocked: true,
                blocksSubmission: false,
                optimisticallyRemovedDiscountIds: [],
            },
            detailsSaveState: { status: "idle" },
            paymentMethod: undefined,
            walletAvailability: { applePay: "unavailable" },
            status: "idle",
            canSubmit: false,
            submissionError: null,
        }),
        subscribe: () => unregister,
        activate: vi.fn(),
        deactivate: vi.fn(),
        updateConfig: vi.fn(),
        refreshSession: vi.fn(),
        applyDiscountCode: vi.fn(async () => false),
        removeDiscountCode: vi.fn(async () => false),
        clearDiscountCodeError: vi.fn(),
        retryDetailsSave: vi.fn(),
        setPaymentMethod: vi.fn(),
        setWalletAvailability: vi.fn(),
        prepareApplePay: vi.fn(async () => null),
        beginApplePayPresentation: vi.fn(() => null),
        validateApplePayMerchant: vi.fn(async () => ({})),
        updateApplePayShippingContact: vi.fn(async () => ({ amount: 0, shippingMethods: [] })),
        updateApplePayShippingMethod: vi.fn(async () => ({ amount: 0, shippingMethods: [] })),
        authorizeApplePay: vi.fn(async () => "failure" as const),
        failApplePayPresentation: vi.fn(),
        beginWalletPresentation: vi.fn(() => false),
        cancelWalletPresentation: vi.fn(),
        submit: vi.fn(),
        getField: () =>
            ({
                state: { value: "", isFocused: false, isValid: true, error: null },
                setValue: vi.fn(),
                setValidator: () => vi.fn(),
                onFocus: vi.fn(),
                onBlur: vi.fn(),
            }) as never,
        getFrame: () => ({
            state: {
                loading: false,
                focused: false,
                empty: true,
                valid: false,
                error: null,
                cardBrand: null,
            },
            clientSecret: "cs_test",
            frameUrl: "https://field.example",
            key: "cs_test::https://field.example",
            setState: vi.fn(),
            setEncryptedData: vi.fn(),
        }),
        autocompleteAddress: async () => [],
        getAddressVerification: () => ({ status: "idle" }),
        verifyAddress: async () => null,
        getBillingSameAsShipping: () => false,
        setBillingSameAsShipping: vi.fn(),
        hasCollector: () => false,
        registerCollector: vi.fn(() => unregister),
        registerFrame: vi.fn(() => unregister),
        registerPaymentElement: vi.fn(() => unregister),
        registerSubmitButton: vi.fn(() => unregister),
        hasSubmitButton: () => false,
        getAddressMetadata: () => ({ status: "fallback", metadata: {} as never }),
    };
}

describe("private renderer contract", () => {
    it("proxies activation, submission, and disposable registrations", () => {
        const core = fakeCore();
        const controller = BiasController.fromCore(core);
        controller.activate();
        controller.attemptPayment();
        const dispose = controller.registerPaymentElement("card");
        dispose();

        expect(core.activate).toHaveBeenCalledOnce();
        expect(core.submit).toHaveBeenCalledOnce();
        expect(core.registerPaymentElement).toHaveBeenCalledWith("card");
    });

    it("maps logical shipping fields onto their private public-field slots", () => {
        const core = fakeCore();
        const getField = vi.spyOn(core, "getField");
        const controller = BiasController.fromCore(core);
        controller.getField("shipping", "postalCode");
        expect(getField).toHaveBeenCalledWith("shippingPostalCode", "shipping");
    });

    it("merges form appearance over inherited variables", () => {
        expect(
            mergeAppearance(
                { variables: { colorPrimary: "red", gap: "8px" }, labelStyle: "static" },
                { variables: { colorPrimary: "blue" }, labelStyle: "floating" },
            ),
        ).toEqual({
            variables: { colorPrimary: "blue", gap: "8px" },
            labelStyle: "floating",
        });
    });

    it("filters unknown session payment methods instead of casting them", () => {
        expect(
            filterSupportedPaymentMethods(["wire", "apple_pay", "card", null, "us_bank_account"]),
        ).toEqual(["card", "us_bank_account"]);
    });

    it("removes stale package-applied variables", () => {
        const node = document.createElement("div");
        const action = appearance(node, { variables: { colorPrimary: "red", gap: "8px" } });
        action.update({ variables: { colorPrimary: "blue" } });

        expect(node.style.getPropertyValue("--bias-color-primary")).toBe("blue");
        expect(node.style.getPropertyValue("--bias-gap")).toBe("");
        action.destroy();
        expect(node.style.getPropertyValue("--bias-color-primary")).toBe("");
    });

    it("re-subscribes reactive reads through the narrow public-state adapter", () => {
        let status: "idle" | "submitting" = "idle";
        const listeners = new Set<() => void>();
        const core = fakeCore();
        core.subscribe = (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        };
        core.getPublicState = () => ({
            sessionState: { status: "idle" },
            discountCodeState: {
                pendingAction: null,
                error: null,
                blocked: true,
                blocksSubmission: false,
                optimisticallyRemovedDiscountIds: [],
            },
            detailsSaveState: { status: "idle" },
            paymentMethod: undefined,
            walletAvailability: { applePay: "unavailable" },
            status,
            canSubmit: false,
            submissionError: null,
        });
        const controller = BiasController.fromCore(core);
        const probe = trackEffect(() => controller.publicState.status);
        expect(probe.values).toEqual(["idle"]);

        status = "submitting";
        for (const listener of listeners) listener();
        probe.flush();
        expect(probe.values).toEqual(["idle", "submitting"]);
        probe.stop();
    });

    it("changes its renderer identity when the secret or frame URL changes", () => {
        const controller = new BiasController({ clientSecret: "cs_test" });
        expect(controller.frameUrl).toBeTruthy();
        const initialKey = controller.sessionKey;

        controller.updateConfig({ clientSecret: "cs_next" });
        const secretKey = controller.sessionKey;
        expect(secretKey).not.toBe(initialKey);

        controller.updateConfig({ frameUrl: "https://frames.example" });
        expect(controller.frameUrl).toBe("https://frames.example");
        expect(controller.sessionKey).not.toBe(secretKey);
    });

    it("does not loop when an effect reads state and performs an idempotent adapter write", () => {
        let selected: "card" | "us_bank_account" | undefined = "card";
        const listeners = new Set<() => void>();
        const core = fakeCore();
        core.subscribe = (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        };
        core.getPublicState = () => ({
            sessionState: { status: "idle" },
            discountCodeState: {
                pendingAction: null,
                error: null,
                blocked: true,
                blocksSubmission: false,
                optimisticallyRemovedDiscountIds: [],
            },
            detailsSaveState: { status: "idle" },
            paymentMethod: selected,
            walletAvailability: { applePay: "unavailable" },
            status: "idle",
            canSubmit: false,
            submissionError: null,
        });
        core.setPaymentMethod = vi.fn((method) => {
            if (method === selected) return;
            selected = method;
            for (const listener of listeners) listener();
        });
        const controller = BiasController.fromCore(core);
        const probe = trackEffect(() => {
            const method = controller.publicState.paymentMethod;
            if (method) controller.setPaymentMethod(method);
            return method;
        });
        probe.flush();

        expect(probe.values).toEqual(["card"]);
        expect(core.setPaymentMethod).toHaveBeenCalledTimes(1);
        probe.stop();
    });
});
