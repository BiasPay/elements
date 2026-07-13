import { afterEach, describe, expect, it, vi } from "vitest";
import type {
    AddressMetadata,
    BiasElementsState,
    ElementsController,
} from "~/core";
import { createMockSession } from "./fixtures/mocks";
import { defineBiasElements, type BiasProviderElement } from "../src/lib";

function fakeCore(
    options: {
        collectsShipping?: boolean;
        collectsBilling?: boolean;
        billingSameAsShipping?: boolean;
    } = {},
) {
    const metadata: AddressMetadata = {
        country: "US",
        postalCode: {
            used: true,
            required: true,
            label: "ZIP",
            error: "Your ZIP code is invalid.",
            regex: null,
            example: "95014",
            numeric: true,
        },
        state: { used: true, required: true, label: "State", options: [] },
        city: { used: true, required: true },
    };
    let state: BiasElementsState = {
        sessionState: { status: "ready", session: createMockSession() },
        paymentMethod: "card",
        status: "idle",
        canSubmit: true,
        submissionError: null,
    };
    const listeners = new Set<() => void>();
    const unregister = vi.fn();
    const core: ElementsController = {
        getPublicState: () => state,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        activate: vi.fn(),
        deactivate: vi.fn(),
        updateConfig: vi.fn(),
        refreshSession: vi.fn(),
        setPaymentMethod: vi.fn(),
        submit: vi.fn(),
        getField: () =>
            ({
                state: { value: "", isFocused: false, isValid: true, error: null },
                setValue: vi.fn(),
                setValidator: () => unregister,
                validate: vi.fn(),
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
            clientSecret: "cs_test_secret_123",
            frameUrl: "https://field.example",
            key: "frame-key",
            setState: vi.fn(),
            setEncryptedData: vi.fn(),
        }),
        autocompleteAddress: async () => [],
        getBillingSameAsShipping: () => options.billingSameAsShipping ?? false,
        setBillingSameAsShipping: vi.fn(),
        hasCollector: (kind, scope) =>
            kind === "address" &&
            ((scope === "shipping" && options.collectsShipping === true) ||
                (scope === "billing" && options.collectsBilling === true)),
        registerCollector: () => unregister,
        registerFrame: () => unregister,
        registerPaymentElement: () => unregister,
        getAddressMetadata: () => ({ status: "ready", metadata }),
        getAddressMetadataForCountry: () => ({ status: "ready", metadata }),
    };
    return {
        core,
        update(next: BiasElementsState) {
            state = next;
            for (const listener of listeners) listener();
        },
    };
}

async function settle() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

afterEach(() => document.body.replaceChildren());

describe("public custom elements", () => {
    it("does not expose service endpoint attributes or properties", () => {
        const provider = document.createElement("bias-provider") as BiasProviderElement;

        expect((provider.constructor as typeof HTMLElement).observedAttributes).toEqual([
            "client-secret",
        ]);
        expect("apiBaseUrl" in provider).toBe(false);
        expect("frameUrl" in provider).toBe(false);
    });

    it("registers idempotently and renders every host in light DOM", async () => {
        expect(() => defineBiasElements()).not.toThrow();
        const { core } = fakeCore();
        const provider = document.createElement("bias-provider");
        provider.controller = core;
        const button = document.createElement("bias-submit-button");
        button.label = "Pay now";
        provider.append(button);
        document.body.append(provider);
        await settle();

        expect(provider.shadowRoot).toBeNull();
        expect(button.shadowRoot).toBeNull();
        expect(button.querySelector("button")?.textContent).toContain("Pay now");
        expect(getComputedStyle(provider).display).toBe("contents");
        expect(getComputedStyle(button).display).toBe("contents");
    });

    it("keeps multiple provider controllers isolated", async () => {
        const first = fakeCore();
        const second = fakeCore();
        const firstProvider = document.createElement("bias-provider");
        const secondProvider = document.createElement("bias-provider");
        firstProvider.controller = first.core;
        secondProvider.controller = second.core;
        firstProvider.append(document.createElement("bias-submit-button"));
        secondProvider.append(document.createElement("bias-submit-button"));
        document.body.append(firstProvider, secondProvider);
        await settle();

        firstProvider.querySelector<HTMLButtonElement>("button")!.click();
        expect(first.core.submit).toHaveBeenCalledOnce();
        expect(second.core.submit).not.toHaveBeenCalled();
    });

    it("submits incomplete forms so the controller can surface validation errors", async () => {
        const controlled = fakeCore();
        controlled.update({
            ...controlled.core.getPublicState(),
            canSubmit: false,
        });
        const provider = document.createElement("bias-provider");
        provider.controller = controlled.core;
        provider.append(document.createElement("bias-submit-button"));
        document.body.append(provider);
        await settle();

        const button = provider.querySelector<HTMLButtonElement>("button")!;
        expect(button.disabled).toBe(false);
        button.click();
        expect(controlled.core.submit).toHaveBeenCalledOnce();
    });

    it("reacts to appearance updates made through the provider property", async () => {
        const { core } = fakeCore();
        const provider = document.createElement("bias-provider") as BiasProviderElement;
        provider.controller = core;
        provider.appearance = { labelStyle: "static" };
        provider.append(document.createElement("bias-contact-element"));
        document.body.append(provider);
        await settle();

        expect(provider.querySelector("label")?.className).not.toContain("bias:sr-only");

        provider.appearance = { labelStyle: "placeholder" };
        await settle();

        expect(provider.querySelector("label")?.className).toContain("bias:sr-only");
        expect(provider.querySelector("input")?.placeholder).toBe("Email");
    });

    it("offers the bank form's billing-same-as-shipping option", async () => {
        defineBiasElements();
        const { core } = fakeCore({ collectsShipping: true });
        const provider = document.createElement("bias-provider");
        provider.controller = core;
        const bank = document.createElement("bias-us-bank-account-element");
        provider.append(bank);
        document.body.append(provider);
        await settle();

        const toggle = bank.querySelector<HTMLInputElement>('input[type="checkbox"]');
        expect(toggle).toBeTruthy();
        expect(bank.textContent).toContain("Use shipping address as billing address");

        toggle!.click();
        expect(core.setBillingSameAsShipping).toHaveBeenCalledWith(true);
    });

    it("rebinds an element moved between providers after disconnection", async () => {
        const first = fakeCore();
        const second = fakeCore();
        const firstProvider = document.createElement("bias-provider");
        const secondProvider = document.createElement("bias-provider");
        firstProvider.controller = first.core;
        secondProvider.controller = second.core;
        const button = document.createElement("bias-submit-button");
        firstProvider.append(button);
        document.body.append(firstProvider, secondProvider);
        await settle();

        button.querySelector<HTMLButtonElement>("button")!.click();
        button.remove();
        await settle();
        secondProvider.append(button);
        await settle();
        button.querySelector<HTMLButtonElement>("button")!.click();

        expect(first.core.submit).toHaveBeenCalledOnce();
        expect(second.core.submit).toHaveBeenCalledOnce();
    });

    it("exposes state, actions, and observable status events", () => {
        const controlled = fakeCore();
        const provider = document.createElement("bias-provider") as BiasProviderElement;
        provider.controller = controlled.core;
        const changes = vi.fn();
        const completes = vi.fn();
        provider.addEventListener("biaschange", changes);
        provider.addEventListener("biascomplete", completes);
        document.body.append(provider);

        expect(provider.status).toBe("idle");
        provider.submit();
        provider.refreshSession();
        expect(controlled.core.submit).toHaveBeenCalledOnce();
        expect(controlled.core.refreshSession).toHaveBeenCalledOnce();

        controlled.update({
            ...controlled.core.getPublicState(),
            status: "succeeded",
            canSubmit: false,
        });
        expect(changes).toHaveBeenCalled();
        expect(completes).toHaveBeenCalledOnce();
    });

    it("initializes when vanilla configuration is assigned after connection", () => {
        const provider = document.createElement("bias-provider") as BiasProviderElement;
        document.body.append(provider);

        expect(provider.controller).toBeUndefined();
        provider.clientSecret = "cs_test_secret_123";
        expect(provider.controller).toBeDefined();
    });
});
