import { afterEach, describe, expect, it, vi } from "vitest";
import type { CheckoutSession } from "@biaspay/sdk-checkout";
import type {
    AddressAutocompleteSuggestion,
    AddressMetadata,
    AddressVerificationState,
    BiasElementsState,
    BiasFieldName,
    ElementsController,
    FrameFieldType,
} from "~/core";
import type { BiasFieldStatus } from "../src/lib/core/types";
import { createMockSession } from "./fixtures/mocks";
import {
    BiasController,
    defineBiasElements,
    type BiasAddressElement,
    type BiasProviderElement,
} from "../src/lib";

function fakeCore(
    options: {
        collectsShipping?: boolean;
        collectsBilling?: boolean;
        billingSameAsShipping?: boolean;
        fieldValues?: Partial<Record<BiasFieldName, string>>;
        addressVerification?: AddressVerificationState;
        paymentMethod?: "card" | "us_bank_account";
        savedPaymentMethods?: BiasElementsState["savedPaymentMethods"];
        savedPaymentMethod?: BiasElementsState["savedPaymentMethod"];
        session?: CheckoutSession;
        frameEmpty?: Partial<Record<FrameFieldType, boolean>>;
        frameUrl?: string;
        applePay?: boolean;
        applePayAuthorization?: "success" | "failure" | "ambiguous";
        applePayValidationFails?: boolean;
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
        state: {
            used: true,
            required: true,
            label: "State",
            options: [{ key: "CA", name: "California" }],
        },
        city: { used: true, required: true },
    };
    let state: BiasElementsState = {
        sessionState: { status: "ready", session: options.session ?? createMockSession() },
        discountCodeState: {
            pendingAction: null,
            error: null,
            blocked: false,
            blocksSubmission: false,
            optimisticallyRemovedDiscountIds: [],
        },
        detailsSaveState: { status: "saved" },
        paymentMethod: options.paymentMethod ?? "card",
        walletAvailability: { applePay: options.applePay ? "loading" : "unavailable" },
        savedPaymentMethods: options.savedPaymentMethods ?? [],
        savedPaymentMethod: options.savedPaymentMethod,
        status: "idle",
        canSubmit: true,
        submissionError: null,
    };
    const listeners = new Set<() => void>();
    const submitButtons = new Set<symbol>();
    let frameKey = "frame-key";
    const frameStates = Object.fromEntries(
        ["cardNumber", "cardExpiry", "cardCvc", "bankRoutingNumber", "bankAccountNumber"].map(
            (field) => [
                field,
                {
                    loading: false,
                    focused: false,
                    empty: options.frameEmpty?.[field as FrameFieldType] ?? true,
                    valid: false,
                    error: null,
                    cardBrand: null,
                },
            ],
        ),
    ) as Record<FrameFieldType, BiasFieldStatus>;
    const unregister = vi.fn();
    const setFieldValue = vi.fn();
    const setSavedPaymentMethod = vi.fn();
    const verifyAddress = vi.fn(async () => null);
    const autocompleteAddress = vi.fn(async (): Promise<AddressAutocompleteSuggestion[]> => []);
    const applePayConfig = {
        enabled: true as const,
        country_code: "US" as const,
        currency_code: "USD" as const,
        supported_networks: ["visa" as const],
        merchant_capabilities: ["supports3DS" as const],
        display_name: "Bias Test",
    };
    const setWalletAvailability = vi.fn(
        (_method: "apple_pay", status: BiasElementsState["walletAvailability"]["applePay"]) => {
            state = { ...state, walletAvailability: { applePay: status } };
            for (const listener of listeners) listener();
        },
    );
    const prepareApplePay = vi.fn(async () => (options.applePay ? applePayConfig : null));
    const presentation = {
        config: applePayConfig,
        checkoutSessionId: options.session?.id ?? "cs_test_123",
        updatedAt: options.session?.updated_at ?? 1,
        amount: 5000,
        currency: "USD",
        requiresBillingContact: false,
        requiresEmail: false,
        requiresPhone: false,
        requiresShippingContact: false,
        shippingMethods: [],
    };
    const beginApplePayPresentation = vi.fn(() => (options.applePay ? presentation : null));
    const validateApplePayMerchant = vi.fn(async () => {
        if (options.applePayValidationFails) throw new Error("validation failed");
        return { merchantSessionIdentifier: "merchant" };
    });
    const updateApplePayShippingContact = vi.fn(async () => ({
        amount: presentation.amount,
        shippingMethods: presentation.shippingMethods,
    }));
    const updateApplePayShippingMethod = vi.fn(async () => ({
        amount: presentation.amount,
        shippingMethods: presentation.shippingMethods,
    }));
    const authorizeApplePay = vi.fn(async () => options.applePayAuthorization ?? "success");
    const cancelWalletPresentation = vi.fn();
    const failApplePayPresentation = vi.fn();
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
        applyDiscountCode: vi.fn(async () => true),
        removeDiscountCode: vi.fn(async () => true),
        clearDiscountCodeError: vi.fn(),
        retryDetailsSave: vi.fn(),
        setPaymentMethod: vi.fn(),
        setSavedPaymentMethod,
        setWalletAvailability,
        beginWalletPresentation: vi.fn(() => false),
        cancelWalletPresentation,
        prepareApplePay,
        beginApplePayPresentation,
        validateApplePayMerchant,
        updateApplePayShippingContact,
        updateApplePayShippingMethod,
        authorizeApplePay,
        failApplePayPresentation,
        clearRememberedDetails: vi.fn(),
        submit: vi.fn(),
        getField: (name) =>
            ({
                state: {
                    value: options.fieldValues?.[name] ?? "",
                    isFocused: false,
                    isValid: true,
                    error: null,
                },
                setValue: setFieldValue,
                setValidator: () => unregister,
                validate: vi.fn(),
                onFocus: vi.fn(),
                onBlur: vi.fn(),
            }) as never,
        getFrame: (field) => ({
            state: frameStates[field],
            clientSecret: "cs_test_secret_123",
            frameUrl: options.frameUrl ?? "https://field.example",
            get key() {
                return frameKey;
            },
            setState: (next) => {
                frameStates[field] = { ...frameStates[field], ...next };
                for (const listener of listeners) listener();
            },
            setEncryptedData: vi.fn(),
        }),
        autocompleteAddress,
        getAddressVerification: () => options.addressVerification ?? { status: "idle" },
        verifyAddress,
        getBillingSameAsShipping: () => options.billingSameAsShipping ?? false,
        setBillingSameAsShipping: vi.fn(),
        hasCollector: (kind, scope) =>
            kind === "address" &&
            ((scope === "shipping" && options.collectsShipping === true) ||
                (scope === "billing" && options.collectsBilling === true)),
        registerCollector: () => unregister,
        registerFrame: () => unregister,
        registerPaymentElement: () => unregister,
        registerSubmitButton: () => {
            const token = Symbol("submit-button");
            submitButtons.add(token);
            for (const listener of listeners) listener();
            return () => {
                submitButtons.delete(token);
                for (const listener of listeners) listener();
            };
        },
        hasSubmitButton: () => submitButtons.size > 0,
        getAddressMetadata: () => ({ status: "ready", metadata }),
        getAddressMetadataForCountry: () => ({ status: "ready", metadata }),
    };
    return {
        core,
        setFieldValue,
        setSavedPaymentMethod,
        verifyAddress,
        autocompleteAddress,
        setWalletAvailability,
        prepareApplePay,
        beginApplePayPresentation,
        validateApplePayMerchant,
        updateApplePayShippingContact,
        updateApplePayShippingMethod,
        authorizeApplePay,
        cancelWalletPresentation,
        failApplePayPresentation,
        setFrameKey(value: string) {
            frameKey = value;
            for (const listener of listeners) listener();
        },
        setFrameEmpty(field: FrameFieldType, empty: boolean) {
            frameStates[field] = { ...frameStates[field], empty };
            for (const listener of listeners) listener();
        },
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

async function waitForStyleCount(styles: string[], count: number) {
    await vi.waitFor(() => expect(styles.length).toBeGreaterThanOrEqual(count));
}

function connectFrame(iframe: HTMLIFrameElement) {
    const styles: string[] = [];
    const placeholders: string[] = [];
    const frameWindow = iframe.contentWindow!;

    class TestMessagePort {
        onmessage: ((event: MessageEvent) => void) | null = null;
        peer?: TestMessagePort;

        postMessage(message: unknown) {
            queueMicrotask(() =>
                this.peer?.onmessage?.(new MessageEvent("message", { data: message })),
            );
        }

        start() {}
        close() {}
    }

    class TestMessageChannel {
        port1 = new TestMessagePort();
        port2 = new TestMessagePort();

        constructor() {
            this.port1.peer = this.port2;
            this.port2.peer = this.port1;
        }
    }

    vi.spyOn(frameWindow, "postMessage").mockImplementation(((
        message: unknown,
        targetOriginOrOptions?: string | WindowPostMessageOptions,
        transfer?: Transferable[],
    ) => {
        const transferred =
            transfer ??
            (typeof targetOriginOrOptions === "object"
                ? targetOriginOrOptions.transfer
                : undefined);
        const port = transferred?.[0] as unknown as TestMessagePort | undefined;
        if (!port?.postMessage) return;

        const initialize = message as { channelId?: string };
        port.onmessage = (event) => {
            const data = event.data as {
                type?: string;
                style?: string;
                placeholder?: string;
            };
            if (data.type === "bias:authenticate-field") {
                port.postMessage({ type: "ready" });
            } else if (data.type === "style" && data.style) {
                styles.push(data.style);
            } else if (data.type === "placeholder" && data.placeholder !== undefined) {
                placeholders.push(data.placeholder);
            }
        };
        port.start();
        port.postMessage({
            type: "bias:channel-ready",
            channelId: initialize.channelId,
        });
    }) as typeof frameWindow.postMessage);

    const NativeMessageChannel = globalThis.MessageChannel;
    globalThis.MessageChannel = TestMessageChannel as unknown as typeof MessageChannel;
    try {
        iframe.dispatchEvent(new Event("load"));
    } finally {
        globalThis.MessageChannel = NativeMessageChannel;
    }
    return { styles, placeholders };
}

afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe("public custom elements", () => {
    it("exposes a same-origin API override without exposing the secure frame URL", () => {
        const provider = document.createElement("bias-provider") as BiasProviderElement;

        expect((provider.constructor as typeof HTMLElement).observedAttributes).toEqual([
            "client-secret",
        ]);
        expect("apiBaseUrl" in provider).toBe(true);
        expect(provider.hasAttribute("api-base-url")).toBe(false);
        expect("frameUrl" in provider).toBe(false);
    });

    it("renders the controlled remembered-details checkbox with its fixed accessible label", async () => {
        const { core } = fakeCore();
        const provider = document.createElement("bias-provider");
        provider.controller = core;
        const checkbox = document.createElement("bias-remember-details-checkbox");
        const onChange = vi.fn();
        checkbox.checked = true;
        checkbox.onRememberDetailsChange = onChange;
        provider.append(checkbox);
        document.body.append(provider);
        await settle();

        const input = checkbox.querySelector<HTMLInputElement>('input[type="checkbox"]');
        expect(input?.checked).toBe(true);
        expect(checkbox.textContent).toContain("Remember my details for faster checkout next time");
        input?.click();
        expect(onChange).toHaveBeenCalledWith(false);
    });

    it("checks remembered details visually on the first click", async () => {
        const { core } = fakeCore();
        const provider = document.createElement("bias-provider");
        provider.controller = core;
        const checkbox = document.createElement("bias-remember-details-checkbox");
        const onChange = vi.fn();
        checkbox.checked = false;
        checkbox.onRememberDetailsChange = onChange;
        provider.append(checkbox);
        document.body.append(provider);
        await settle();

        const input = checkbox.querySelector<HTMLInputElement>('input[type="checkbox"]');
        input?.click();
        await settle();

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(true);
        expect(input?.checked).toBe(true);
        expect(checkbox.querySelector(".box")?.classList.contains("boxChecked")).toBe(true);
    });

    it.each(["presenting_wallet", "submitting"] as const)(
        "keeps remembered details enabled but locked while %s",
        async (status) => {
            defineBiasElements();
            const fake = fakeCore({ collectsShipping: true, billingSameAsShipping: true });
            const provider = document.createElement("bias-provider");
            provider.controller = fake.core;
            const card = document.createElement("bias-card-element");
            const checkbox = document.createElement("bias-remember-details-checkbox");
            const onChange = vi.fn();
            checkbox.checked = true;
            checkbox.onRememberDetailsChange = onChange;
            provider.append(card, checkbox);
            document.body.append(provider);
            await settle();

            fake.update({ ...fake.core.getPublicState(), status });
            await settle();

            const [billing, remember] = [card, checkbox].map((host) =>
                host.querySelector<HTMLInputElement>('input[type="checkbox"]')!,
            );
            expect([billing.disabled, remember.disabled]).toEqual([false, false]);

            remember.click();
            await settle();

            expect(onChange).not.toHaveBeenCalled();
            expect(remember.checked).toBe(true);
            expect(checkbox.querySelector(".box")?.classList.contains("boxChecked")).toBe(true);

            fake.update({ ...fake.core.getPublicState(), status: "failed" });
            await settle();
            remember.click();

            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange).toHaveBeenCalledWith(false);
        },
    );

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

    it.each([null, undefined, "", " \t "])(
        "renders remembered cards with a fallback for blank name %j",
        async (name) => {
            const saved = {
                object: "payment_method",
                id: "pm_saved",
                live: false,
                created_at: 1,
                active: true,
                type: "card",
                billing_details: { name: "  Ada Lovelace  " },
                card: { brand: "Visa", last4: "4242", exp_month: 12, exp_year: 2030 },
                us_bank_account: null,
            } as any;
            const savedWithoutName = {
                ...saved,
                id: "pm_saved_without_name",
                billing_details: { name },
                card: { ...saved.card, last4: "1881", exp_month: 1, exp_year: 2029 },
            };
            const { core, setSavedPaymentMethod } = fakeCore({
                savedPaymentMethods: [saved, savedWithoutName],
                savedPaymentMethod: saved,
            });
            const provider = document.createElement("bias-provider");
            provider.controller = core;
            const payment = document.createElement("bias-payment-element");
            payment.paymentMethodLayout = "radio";
            provider.append(payment);
            document.body.append(provider);
            await settle();

            const radios = payment.querySelectorAll<HTMLElement>('[role="radio"]');
            expect(radios).toHaveLength(3);
            expect(radios[0]?.textContent).toContain("•••• 4242");
            expect(radios[0]?.textContent).toContain("Ada Lovelace");
            expect(radios[0]?.textContent).toContain("Expires 12/30");
            expect(radios[0]?.textContent?.indexOf("Ada Lovelace")).toBeLessThan(
                radios[0]?.textContent?.indexOf("Expires 12/30") ?? 0,
            );
            expect(radios[0]?.querySelector("title")?.textContent).toBe("Visa");
            const namelessExpiration = [...(radios[1]?.querySelectorAll("span") ?? [])].find(
                (span) => span.textContent === "Expires 01/29",
            );
            expect(namelessExpiration?.classList.contains("bias:text-muted-foreground")).toBe(true);
            expect(radios[2]?.textContent?.trim()).toBe("Card");
            expect(
                [...radios[0]!.querySelectorAll("span")].some(
                    (span) => span.textContent === "Ada Lovelace",
                ),
            ).toBe(true);

            payment.savedPaymentMethodEmail = "shopper@example.com";
            await settle();
            expect(radios[0]?.textContent).not.toContain("shopper@example.com");
            expect(radios[1]?.textContent).toContain("shopper@example.com");
            expect(namelessExpiration?.textContent).toBe("Expires 01/29");
            expect(namelessExpiration?.classList.contains("bias:text-muted-foreground")).toBe(true);

            payment.setAttribute("saved-payment-method-email", "updated@example.com");
            await settle();
            expect(radios[1]?.textContent).toContain("updated@example.com");
            expect(radios[1]?.textContent).not.toContain("shopper@example.com");

            payment.savedPaymentMethodEmail = undefined;
            await settle();
            expect(radios[1]?.textContent).not.toContain("updated@example.com");
            expect(saved.billing_details.name).toBe("  Ada Lovelace  ");
            expect(savedWithoutName.billing_details.name).toBe(name);
            radios[0]?.click();
            expect(setSavedPaymentMethod).toHaveBeenCalledWith("pm_saved");
        },
    );

    it("keeps embedded billing mounted inside only the new-method panel", async () => {
        const saved = {
            object: "payment_method",
            id: "pm_saved",
            live: false,
            created_at: 1,
            active: true,
            type: "card",
            billing_details: { name: "Ada Lovelace" },
            card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030 },
            us_bank_account: null,
        } as any;
        const { core } = fakeCore({
            savedPaymentMethods: [saved],
            savedPaymentMethod: saved,
        });
        const provider = document.createElement("bias-provider");
        provider.controller = core;
        const payment = document.createElement("bias-payment-element");
        payment.paymentMethodLayout = "radio";
        payment.collectBillingName = true;
        payment.collectBillingAddress = true;
        provider.append(payment);
        document.body.append(provider);
        await settle();

        const options = payment.querySelectorAll<HTMLElement>(".bias-paymentMethodRadioOption");
        expect(options).toHaveLength(2);
        expect(options[0]?.querySelector(".bias-billingDetails")).toBeNull();
        expect(options[1]?.querySelector(".bias-billingDetails")).not.toBeNull();
        expect(options[1]?.textContent).not.toContain("Billing address");
        expect(options[1]?.textContent).toContain("First name");
        expect(options[1]?.querySelector('input[type="tel"]')).toBeNull();
        expect(options[1]?.querySelector("[inert]")).not.toBeNull();
    });

    it("collects phone only for shipping address elements", async () => {
        const { core } = fakeCore();
        const provider = document.createElement("bias-provider");
        provider.controller = core;
        const billing = document.createElement("bias-address-element");
        billing.collectPhone = true;
        const shipping = document.createElement("bias-address-element");
        shipping.scope = "shipping";
        shipping.collectPhone = true;
        provider.append(billing, shipping);
        document.body.append(provider);
        await settle();

        expect(billing.querySelector('input[type="tel"]')).toBeNull();
        expect(shipping.querySelector('input[type="tel"]')).not.toBeNull();
    });

    it("shows amount_remaining on the submit button", async () => {
        defineBiasElements();
        const { core } = fakeCore({
            session: createMockSession({
                total: 2_946,
                amount_remaining: 2_946,
                shipping_cost: { shipping_rate: "shr_standard", amount: 500 },
                tax_total: 196,
            }),
        });
        const provider = document.createElement("bias-provider");
        provider.controller = core;
        const button = document.createElement("bias-submit-button");
        provider.append(button);
        document.body.append(provider);
        await settle();

        expect(button.querySelector("button")?.textContent?.replace(/\s+/g, " ").trim()).toBe(
            "Pay $29.46",
        );
    });

    it("disables the discount-code apply button and shows its spinner while applying", async () => {
        defineBiasElements();
        const controlled = fakeCore({
            session: createMockSession({ allow_discount_codes: true }),
        });
        const provider = document.createElement("bias-provider");
        provider.controller = controlled.core;
        const discountCode = document.createElement("bias-discount-code-element");
        provider.append(discountCode);
        document.body.append(provider);
        await settle();

        const input = discountCode.querySelector<HTMLInputElement>("input")!;
        input.value = "SAVE20";
        input.dispatchEvent(new InputEvent("input", { bubbles: true }));
        controlled.update({
            ...controlled.core.getPublicState(),
            discountCodeState: {
                pendingAction: "apply",
                error: null,
                blocked: true,
                blocksSubmission: true,
                optimisticallyRemovedDiscountIds: [],
            },
            canSubmit: false,
        });
        await settle();

        const button = discountCode.querySelector<HTMLButtonElement>("button[type=submit]")!;
        expect(button.disabled).toBe(true);
        expect(button.querySelector(".spinner")).not.toBeNull();
    });

    it("keeps the discount-code input editable while session refreshes and removals settle", async () => {
        defineBiasElements();
        const session = createMockSession({ allow_discount_codes: true });
        const controlled = fakeCore({ session });
        const provider = document.createElement("bias-provider");
        provider.controller = controlled.core;
        const discountCode = document.createElement("bias-discount-code-element");
        provider.append(discountCode);
        document.body.append(provider);
        await settle();

        const input = discountCode.querySelector<HTMLInputElement>("input")!;
        const applyButton = discountCode.querySelector<HTMLButtonElement>("button[type=submit]")!;

        controlled.update({
            ...controlled.core.getPublicState(),
            sessionState: { status: "refreshing", session },
            discountCodeState: {
                pendingAction: null,
                error: null,
                blocked: true,
                blocksSubmission: false,
                optimisticallyRemovedDiscountIds: [],
            },
        });
        await settle();

        expect(input.disabled).toBe(false);
        expect(input.closest(".bias-field")?.className).not.toContain("bias-fieldDisabled");
        expect(applyButton.disabled).toBe(true);

        controlled.update({
            ...controlled.core.getPublicState(),
            sessionState: { status: "ready", session },
            discountCodeState: {
                pendingAction: "remove",
                error: null,
                blocked: true,
                blocksSubmission: true,
                optimisticallyRemovedDiscountIds: ["di_1"],
            },
        });
        await settle();

        expect(input.disabled).toBe(false);
        expect(input.closest(".bias-field")?.className).not.toContain("bias-fieldDisabled");
        expect(applyButton.disabled).toBe(true);
    });

    it("uses the shared input semantics and label styles for discount codes", async () => {
        defineBiasElements();
        const controlled = fakeCore({
            session: createMockSession({ allow_discount_codes: true }),
        });
        const provider = document.createElement("bias-provider") as BiasProviderElement;
        provider.controller = controlled.core;
        provider.appearance = { labelStyle: "static" };
        const discountCode = document.createElement("bias-discount-code-element");
        provider.append(discountCode);
        document.body.append(provider);
        await settle();

        let input = discountCode.querySelector<HTMLInputElement>("input")!;
        let label = discountCode.querySelector<HTMLLabelElement>("label")!;
        expect(input.id).not.toBe("");
        expect(label.htmlFor).toBe(input.id);
        expect(input.placeholder).toBe("");
        expect(label.className).not.toContain("bias:sr-only");
        expect(input.hasAttribute("data-bias-hostfield")).toBe(true);

        provider.appearance = { labelStyle: "placeholder" };
        await settle();

        input = discountCode.querySelector<HTMLInputElement>("input")!;
        label = discountCode.querySelector<HTMLLabelElement>("label")!;
        expect(label.className).toContain("bias:sr-only");
        expect(input.placeholder).toBe("Discount code");

        provider.appearance = { labelStyle: "floating" };
        await settle();

        input = discountCode.querySelector<HTMLInputElement>("input")!;
        input.value = "SAVE20";
        input.dispatchEvent(new InputEvent("input", { bubbles: true }));
        await settle();

        expect(discountCode.querySelector(".bias-floatingLabel")?.className).toContain("shrink");

        controlled.update({
            ...controlled.core.getPublicState(),
            discountCodeState: {
                pendingAction: null,
                error: "Enter a valid discount code.",
                blocked: false,
                blocksSubmission: false,
                optimisticallyRemovedDiscountIds: [],
            },
        });
        await settle();

        const error = discountCode.querySelector<HTMLElement>("[role=alert]")!;
        expect(input.getAttribute("aria-describedby")).toBe(error.id);
        expect(input.getAttribute("aria-invalid")).toBe("true");
    });

    it("always tells secure fields the host origin, even under a no-referrer policy", async () => {
        defineBiasElements();
        const controlled = fakeCore({ frameUrl: `${window.location.origin}/@vite/client` });
        const provider = document.createElement("bias-provider") as BiasProviderElement;
        provider.controller = controlled.core;
        const card = document.createElement("bias-card-element");
        provider.append(card);
        document.body.append(provider);
        await settle();

        const iframes = card.querySelectorAll<HTMLIFrameElement>("iframe");
        expect(iframes.length).toBeGreaterThan(0);
        for (const iframe of iframes) expect(iframe.referrerPolicy).toBe("origin");
    });

    it("loads a fresh secure field document when the checkout session changes", async () => {
        defineBiasElements();
        const controlled = fakeCore({ frameUrl: `${window.location.origin}/@vite/client` });
        const provider = document.createElement("bias-provider") as BiasProviderElement;
        provider.controller = controlled.core;
        const card = document.createElement("bias-card-element");
        provider.append(card);
        document.body.append(provider);
        await settle();

        const group = card.querySelector<HTMLElement>(".bias-formField_cardNumber")!;
        const original = group.querySelector<HTMLIFrameElement>("iframe")!;
        await vi.waitFor(() => expect(original.contentDocument?.readyState).toBe("complete"));
        await waitForStyleCount(connectFrame(original).styles, 1);

        // A field document accepts exactly one private channel, so the new session's
        // controller needs a new document rather than the already-bound one.
        controlled.setFrameKey("replacement-client-secret:https://api.example");
        await settle();
        const replacement = group.querySelector<HTMLIFrameElement>("iframe")!;
        expect(replacement).not.toBe(original);
        expect(original.isConnected).toBe(false);
        await vi.waitFor(() => expect(replacement.contentDocument?.readyState).toBe("complete"));
        await waitForStyleCount(connectFrame(replacement).styles, 1);
    });

    it("moves secure-field text with padding while keeping the iframe fixed and clickable", async () => {
        defineBiasElements();
        const controlled = fakeCore({
            frameEmpty: { cardExpiry: false },
            frameUrl: `${window.location.origin}/@vite/client`,
        });
        const provider = document.createElement("bias-provider") as BiasProviderElement;
        provider.controller = controlled.core;
        provider.appearance = { labelStyle: "floating" };
        const card = document.createElement("bias-card-element");
        provider.append(card);
        document.body.append(provider);
        await settle();

        const group = card.querySelector<HTMLElement>(".bias-formField_cardExpiry")!;
        const iframe = group.querySelector<HTMLIFrameElement>("iframe")!;
        await vi.waitFor(() => expect(iframe.contentDocument?.readyState).toBe("complete"));
        const { styles, placeholders } = connectFrame(iframe);
        await waitForStyleCount(styles, 1);
        await vi.waitFor(() => expect(placeholders.at(-1)).toBe("Expiration"));

        expect(group.querySelector(".bias-floatingLabel")?.className).toContain("shrink");
        expect(group.querySelector(".bias-fieldPlaceholder")).toBeNull();
        const paddingBlockStart = (style: string | undefined) =>
            style?.match(/padding-block-start:\s*([^;]+);/)?.[1];
        const shrunkPadding = paddingBlockStart(styles.at(-1));
        expect(shrunkPadding).toBeDefined();

        iframe.scrollIntoView({ block: "center" });
        const initialRect = iframe.getBoundingClientRect();
        const filledStyleCount = styles.length;
        controlled.setFrameEmpty("cardExpiry", true);
        await waitForStyleCount(styles, filledStyleCount + 1);

        expect(group.querySelector(".bias-floatingLabel")?.className).not.toContain("shrink");
        expect(paddingBlockStart(styles.at(-1))).toBeDefined();
        expect(paddingBlockStart(styles.at(-1))).not.toBe(shrunkPadding);
        expect(iframe.getBoundingClientRect()).toEqual(initialRect);

        // Frame empty-state changes are also how autofill reports a newly populated value.
        const emptyStyleCount = styles.length;
        controlled.setFrameEmpty("cardExpiry", false);
        await waitForStyleCount(styles, emptyStyleCount + 1);

        expect(group.querySelector(".bias-floatingLabel")?.className).toContain("shrink");
        expect(paddingBlockStart(styles.at(-1))).toBe(shrunkPadding);
        expect(iframe.getBoundingClientRect()).toEqual(initialRect);

        const { width, height } = initialRect;
        const edgePositions = [
            { x: 1, y: height / 2 },
            { x: width - 2, y: height / 2 },
            { x: width / 2, y: 1 },
            { x: width / 2, y: height - 2 },
        ];
        for (const position of edgePositions) {
            const clickTarget = document.elementFromPoint(
                initialRect.left + position.x,
                initialRect.top + position.y,
            );
            expect(clickTarget).toBe(iframe);
            iframe.focus();
            expect(document.activeElement).toBe(iframe);
            iframe.blur();
        }
    });

    it("resynchronizes a populated secure field when label style changes at runtime", async () => {
        defineBiasElements();
        const controlled = fakeCore({
            frameEmpty: { cardExpiry: false },
            frameUrl: `${window.location.origin}/@vite/client`,
        });
        const provider = document.createElement("bias-provider") as BiasProviderElement;
        provider.controller = controlled.core;
        provider.appearance = { labelStyle: "static" };
        const card = document.createElement("bias-card-element");
        provider.append(card);
        document.body.append(provider);
        await settle();

        const group = card.querySelector<HTMLElement>(".bias-formField_cardExpiry")!;
        expect(group.querySelector(".bias-floatingLabel")).toBeNull();

        provider.appearance = { labelStyle: "floating" };
        await settle();

        expect(group.querySelector(".bias-floatingLabel")?.className).toContain("shrink");
        const iframe = group.querySelector<HTMLIFrameElement>("iframe")!;
        await vi.waitFor(() => expect(iframe.contentDocument?.readyState).toBe("complete"));
        const { styles, placeholders } = connectFrame(iframe);
        await waitForStyleCount(styles, 1);
        await vi.waitFor(() => expect(placeholders.at(-1)).toBe("Expiration"));
        expect(styles.at(-1)).toContain("padding-block-start: calc(0.6875rem * (1 + 0.675));");
    });

    it("submits the entered code through the provider controller and forwards synchronization", async () => {
        defineBiasElements();
        const { core } = fakeCore({
            session: createMockSession({ allow_discount_codes: true }),
        });
        const provider = document.createElement("bias-provider");
        provider.controller = core;
        const discountCode = document.createElement("bias-discount-code-element");
        const synchronize = vi.fn();
        discountCode.onDiscountCodeChange = synchronize;
        provider.append(discountCode);
        document.body.append(provider);
        await settle();

        const input = discountCode.querySelector<HTMLInputElement>("input")!;
        input.value = "  SAVE20  ";
        input.dispatchEvent(new InputEvent("input", { bubbles: true }));
        discountCode
            .querySelector("form")!
            .dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
        await settle();

        expect(core.applyDiscountCode).toHaveBeenCalledWith("  SAVE20  ", synchronize);
        expect(input.value).toBe("");
    });

    it("shows a payment error above the submit button, or under the payment form without one", async () => {
        defineBiasElements();
        const controlled = fakeCore();
        const provider = document.createElement("bias-provider");
        provider.controller = controlled.core;
        const payment = document.createElement("bias-payment-element");
        const between = document.createElement("p");
        const button = document.createElement("bias-submit-button");
        provider.append(payment, between, button);
        document.body.append(provider);
        await settle();

        controlled.update({
            ...controlled.core.getPublicState(),
            status: "failed",
            submissionError: Object.assign(new Error("Your card was declined."), {
                code: "payment_failed" as const,
                retryable: true,
            }),
        });
        await settle();
        const alert = () => provider.querySelector<HTMLElement>('[role="alert"]');
        expect(provider.querySelectorAll('[role="alert"]')).toHaveLength(1);
        expect(button.contains(alert())).toBe(true);
        expect(alert()!.compareDocumentPosition(button.querySelector("button")!)).toBe(
            Node.DOCUMENT_POSITION_FOLLOWING,
        );

        button.remove();
        await settle();
        expect(provider.querySelectorAll('[role="alert"]')).toHaveLength(1);
        expect(payment.contains(alert())).toBe(true);
        expect(alert()!.textContent?.trim()).toBe("Your card was declined.");
    });

    it("shows the dual-pricing amount remaining for cards", async () => {
        defineBiasElements();
        const { core } = fakeCore({
            session: createMockSession({
                total: 2_946,
                amount_remaining: 2_946,
                dual_pricing: { rate: 3, amount_remaining: 3_034 },
                shipping_cost: { shipping_rate: "shr_standard", amount: 500 },
                tax_total: 196,
            }),
        });
        const provider = document.createElement("bias-provider");
        provider.controller = core;
        const button = document.createElement("bias-submit-button");
        provider.append(button);
        document.body.append(provider);
        await settle();

        expect(button.querySelector("button")?.textContent?.replace(/\s+/g, " ").trim()).toBe(
            "Pay $30.34",
        );
    });

    it("shows only the amount still due after a partial payment", async () => {
        defineBiasElements();
        const { core } = fakeCore({
            session: createMockSession({
                total: 2_946,
                amount_collected: 1_000,
                amount_remaining: 1_946,
                shipping_cost: { shipping_rate: "shr_standard", amount: 500 },
                tax_total: 196,
            }),
        });
        const provider = document.createElement("bias-provider");
        provider.controller = core;
        const button = document.createElement("bias-submit-button");
        provider.append(button);
        document.body.append(provider);
        await settle();

        expect(button.querySelector("button")?.textContent?.replace(/\s+/g, " ").trim()).toBe(
            "Pay $19.46",
        );
    });

    it("shows no amount while nothing remains to collect", async () => {
        defineBiasElements();
        const { core } = fakeCore({
            session: createMockSession({ total: 2_946, amount_remaining: 0 }),
        });
        const provider = document.createElement("bias-provider");
        provider.controller = core;
        const button = document.createElement("bias-submit-button");
        provider.append(button);
        document.body.append(provider);
        await settle();

        expect(button.querySelector("button")?.textContent?.replace(/\s+/g, " ").trim()).toBe(
            "Pay",
        );
    });

    it("expands a shipping address hydrated from an initial session containing only line 1", async () => {
        const seed = createMockSession({
            shipping_details: {
                name: null,
                phone: null,
                address: {
                    line1: "123 Main Street",
                    line2: null,
                    city: null,
                    state: null,
                    postal_code: null,
                    country: null,
                },
            },
        });
        const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValue(Response.json(seed));
        const controller = new BiasController({
            clientSecret: seed.client_secret,
        });
        const provider = document.createElement("bias-provider") as BiasProviderElement;
        provider.controller = controller;
        const address = document.createElement("bias-address-element");
        address.scope = "shipping";
        provider.append(address);
        document.body.append(provider);

        await settle();
        controller.activate();
        await settle();

        await vi.waitFor(() =>
            expect(
                address.querySelector<HTMLInputElement>('input[aria-autocomplete="list"]')?.value,
            ).toBe("123 Main Street"),
        );
        const firstName = address.querySelector('input[autocomplete="shipping given-name"]');
        const lastName = address.querySelector('input[autocomplete="shipping family-name"]');
        expect(firstName).not.toBeNull();
        expect(lastName).not.toBeNull();
        expect(firstName?.closest(".bias-row")).toBe(lastName?.closest(".bias-row"));
        expect(
            address.querySelector('input[autocomplete="shipping address-line1"]'),
        ).not.toBeNull();
        expect(
            address.querySelector('input[autocomplete="shipping address-line2"]'),
        ).not.toBeNull();
        expect(
            address.querySelector('input[autocomplete="shipping address-level2"]'),
        ).not.toBeNull();
        expect(
            address.querySelector('select[autocomplete="shipping address-level1"]'),
        ).not.toBeNull();
        const state = address.querySelector<HTMLSelectElement>(
            'select[autocomplete="shipping address-level1"]',
        )!;
        expect(state.getAttribute("aria-label")).toBe("State");
        expect([...state.options].slice(-3).map(({ value }) => value)).toEqual(["AA", "AE", "AP"]);
        expect(address.querySelector('input[autocomplete="shipping postal-code"]')).not.toBeNull();
        expect(address.querySelector('select[autocomplete="shipping country"]')).not.toBeNull();

        controller.deactivate();
        fetchSpy.mockRestore();
    });

    it("keeps every address field in the DOM while visually collapsed and expands on blur", async () => {
        const seed = createMockSession();
        const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValue(Response.json(seed));
        const controller = new BiasController({
            clientSecret: seed.client_secret,
        });
        const provider = document.createElement("bias-provider") as BiasProviderElement;
        provider.controller = controller;
        const address = document.createElement("bias-address-element") as BiasAddressElement;
        address.collectPhone = true;
        provider.append(address);
        document.body.append(provider);

        await settle();
        controller.activate();
        await settle();

        await vi.waitFor(() =>
            expect(
                address.querySelector('input[autocomplete="billing address-line2"]'),
            ).not.toBeNull(),
        );

        const line1 = address.querySelector<HTMLInputElement>('input[aria-autocomplete="list"]')!;
        const disclosure = address.querySelector(".bias-disclosure")!;
        expect(address.querySelector('input[autocomplete="billing address-line2"]')).not.toBeNull();
        expect(
            address.querySelector('input[autocomplete="billing address-level2"]'),
        ).not.toBeNull();
        expect(address.querySelector('[autocomplete="billing address-level1"]')).not.toBeNull();
        expect(address.querySelector('input[autocomplete="billing postal-code"]')).not.toBeNull();
        expect(address.querySelector('input[type="tel"]')).toBeNull();
        expect(disclosure.hasAttribute("data-expanded")).toBe(false);

        line1.focus();
        line1.value = "123 Main Street";
        line1.dispatchEvent(
            new InputEvent("input", {
                bubbles: true,
                composed: true,
                data: "t",
                inputType: "insertText",
            }),
        );
        await settle();

        expect(disclosure.hasAttribute("data-expanded")).toBe(false);

        line1.blur();
        await settle();

        expect(disclosure.hasAttribute("data-expanded")).toBe(true);

        controller.deactivate();
        fetchSpy.mockRestore();
    });

    it("does not show Required for an untouched phone until it has been edited", async () => {
        const seed = createMockSession();
        const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValue(Response.json(seed));
        const controller = new BiasController({ clientSecret: seed.client_secret });
        const provider = document.createElement("bias-provider") as BiasProviderElement;
        provider.controller = controller;
        const address = document.createElement("bias-address-element") as BiasAddressElement;
        address.scope = "shipping";
        address.collectPhone = true;
        provider.append(address);
        document.body.append(provider);

        await settle();
        controller.activate();
        await settle();

        await vi.waitFor(() =>
            expect(address.querySelector<HTMLInputElement>('input[type="tel"]')).not.toBeNull(),
        );
        const phone = address.querySelector<HTMLInputElement>('input[type="tel"]')!;
        const phoneGroup = address.querySelector<HTMLElement>(".bias-formField_shippingPhone")!;

        phone.focus();
        phone.blur();
        await settle();
        expect(phoneGroup.querySelector(".bias-formError")).toBeNull();

        phone.focus();
        phone.value = "1";
        phone.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
        phone.value = "";
        phone.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
        phone.blur();

        await vi.waitFor(() =>
            expect(phoneGroup.querySelector(".bias-formError")?.textContent).toContain("Required"),
        );

        controller.deactivate();
        fetchSpy.mockRestore();
    });

    it("dismisses address suggestions immediately on blur", async () => {
        vi.useFakeTimers();
        const { core, autocompleteAddress } = fakeCore();
        autocompleteAddress.mockResolvedValue([
            {
                label: "123 Main Street",
                secondary_label: "Los Angeles, CA",
                full_address: "123 Main Street, Los Angeles, CA 90001",
                components: { address: "123 Main Street" },
            },
        ]);
        const provider = document.createElement("bias-provider");
        provider.controller = core;
        const address = document.createElement("bias-address-element");
        provider.append(address);
        document.body.append(provider);
        await settle();

        const line1 = address.querySelector<HTMLInputElement>('input[aria-autocomplete="list"]')!;
        const panel = address.querySelector<HTMLElement>("[popover]")!;
        line1.focus();
        line1.value = "123 Main";
        line1.dispatchEvent(
            new InputEvent("input", {
                bubbles: true,
                composed: true,
                data: "n",
                inputType: "insertText",
            }),
        );
        await vi.advanceTimersByTimeAsync(250);
        await settle();

        expect(panel.matches(":popover-open")).toBe(true);

        line1.blur();
        await settle();

        expect(panel.matches(":popover-open")).toBe(false);
    });

    it("does not run typeahead for a pasted or externally-filled street address", async () => {
        vi.useFakeTimers();
        const { core, autocompleteAddress, verifyAddress } = fakeCore();
        const provider = document.createElement("bias-provider");
        provider.controller = core;
        const address = document.createElement("bias-address-element");
        address.scope = "shipping";
        provider.append(address);
        document.body.append(provider);
        await settle();

        const line1 = address.querySelector<HTMLInputElement>(
            'input[autocomplete="shipping address-line1"]',
        )!;
        line1.value = "123 Main Street";
        line1.dispatchEvent(
            new InputEvent("input", {
                bubbles: true,
                composed: true,
                data: "123 Main Street",
                inputType: "insertFromPaste",
            }),
        );
        await vi.advanceTimersByTimeAsync(300);
        await settle();

        expect(autocompleteAddress).not.toHaveBeenCalled();
        expect(address.querySelector(".bias-disclosure")?.className).toContain(
            "bias:grid-rows-[1fr]",
        );
        expect(verifyAddress).toHaveBeenCalledWith("shipping");

        verifyAddress.mockClear();
        line1.value = "456 Side Street";
        line1.dispatchEvent(
            new InputEvent("input", {
                bubbles: true,
                composed: true,
                data: null,
                inputType: "insertReplacementText",
            }),
        );
        await vi.advanceTimersByTimeAsync(300);

        expect(autocompleteAddress).not.toHaveBeenCalled();
        expect(verifyAddress).toHaveBeenCalledWith("shipping");
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

    it("toggles contact email read-only without clearing its value or disabling it", async () => {
        const { core, setFieldValue } = fakeCore({ fieldValues: { email: "saved@example.com" } });
        const provider = document.createElement("bias-provider");
        provider.controller = core;
        const contact = document.createElement("bias-contact-element");
        contact.readOnly = true;
        provider.append(contact);
        document.body.append(provider);
        await settle();

        const input = contact.querySelector<HTMLInputElement>('input[type="email"]')!;
        expect(input.readOnly).toBe(true);
        expect(input.disabled).toBe(false);
        expect(input.value).toBe("saved@example.com");

        contact.readOnly = false;
        await settle();
        expect(input.readOnly).toBe(false);
        input.value = "purchase@example.com";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        expect(setFieldValue).toHaveBeenCalledWith("purchase@example.com");

        contact.readOnly = true;
        await settle();
        expect(input.readOnly).toBe(true);
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

    it("reveals remaining address fields when a saved street address is hydrated", async () => {
        defineBiasElements();
        const { core } = fakeCore({
            fieldValues: {
                shippingCountry: "US",
                shippingAddressLine1: "1 Apple Park Way",
            },
        });
        const provider = document.createElement("bias-provider");
        provider.controller = core;
        const address = document.createElement("bias-address-element");
        address.scope = "shipping";
        provider.append(address);
        document.body.append(provider);
        await settle();

        expect(address.querySelector(".bias-disclosure")?.hasAttribute("data-expanded")).toBe(true);
        expect(address.querySelector(".bias-city input")).toBeTruthy();
    });

    it("renders accessible invalid ZIP feedback and applies its button suggestion", async () => {
        vi.useFakeTimers();
        defineBiasElements();
        const controlled = fakeCore({
            fieldValues: {
                shippingCountry: "US",
                shippingAddressLine1: "123 Main St",
                shippingCity: "Calabasas",
                shippingState: "CA",
                shippingPostalCode: "10001",
            },
            addressVerification: {
                status: "verified",
                result: {
                    verdict: "invalid",
                    confidence: "high",
                    suggested_address: {
                        line1: "123 Main Street",
                        line2: null,
                        city: "Calabasas",
                        state: "CA",
                        postal_code: "91302",
                        country: "US",
                    },
                    reason: "postal_region_mismatch",
                },
            },
        });
        const provider = document.createElement("bias-provider");
        provider.controller = controlled.core;
        const address = document.createElement("bias-address-element");
        address.scope = "shipping";
        provider.append(address);
        document.body.append(provider);
        await settle();

        expect(address.querySelector('[role="alert"]')).toBeNull();
        await vi.advanceTimersByTimeAsync(499);
        await settle();
        expect(address.querySelector('[role="alert"]')).toBeNull();

        await vi.advanceTimersByTimeAsync(1);
        await settle();
        const feedback = address.querySelector<HTMLElement>('[role="alert"]')!;
        const input = address.querySelector<HTMLInputElement>(".bias-postalCode input")!;
        const suggestion = feedback.querySelector<HTMLButtonElement>("button")!;
        expect(feedback.textContent).toContain("Enter a valid ZIP code for California");
        expect(suggestion.type).toBe("button");
        expect(suggestion.textContent).toBe("91302");
        expect(input.getAttribute("aria-describedby")).toContain(feedback.id);
        expect(input.getAttribute("aria-invalid")).toBe("true");

        suggestion.click();
        expect(controlled.setFieldValue).toHaveBeenCalledWith("91302");
        expect(controlled.verifyAddress).toHaveBeenCalledWith("shipping");
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

    it("exposes state, actions, and observable status events", async () => {
        vi.useFakeTimers();
        const controlled = fakeCore();
        const provider = document.createElement("bias-provider") as BiasProviderElement;
        provider.controller = controlled.core;
        const changes = vi.fn();
        const completes = vi.fn();
        provider.addEventListener("biaschange", changes);
        provider.addEventListener("biascomplete", completes);
        document.body.append(provider);

        expect(provider.status).toBe("idle");
        expect(provider.detailsSaveState.status).toBe("saved");
        provider.submit();
        provider.refreshSession();
        provider.retryDetailsSave();
        expect(controlled.core.submit).toHaveBeenCalledOnce();
        expect(controlled.core.refreshSession).toHaveBeenCalledOnce();
        expect(controlled.core.retryDetailsSave).toHaveBeenCalledOnce();

        controlled.update({
            ...controlled.core.getPublicState(),
            status: "succeeded",
            canSubmit: false,
        });
        expect(changes).toHaveBeenCalled();
        expect(completes).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(999);
        expect(completes).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(completes).toHaveBeenCalledOnce();
    });

    it("renders wallet-only and mixed Apple Pay layouts without a false no-method fallback", async () => {
        class MockApplePaySession {
            static STATUS_SUCCESS = 1;
            static STATUS_FAILURE = 0;
            static canMakePayments = vi.fn(() => true);
            constructor(_version: number, _request: unknown) {}
            begin() {}
            abort() {}
            completeMerchantValidation() {}
            completePayment() {}
        }
        vi.stubGlobal("ApplePaySession", MockApplePaySession);

        const walletOnly = fakeCore({
            applePay: true,
            session: createMockSession({ payment_method_types: ["apple_pay"] }),
        });
        const walletProvider = document.createElement("bias-provider");
        walletProvider.controller = walletOnly.core;
        const walletExpress = document.createElement("bias-express-checkout-element");
        const walletPayment = document.createElement("bias-payment-element");
        walletProvider.append(walletExpress, walletPayment);

        const mixed = fakeCore({
            applePay: true,
            session: createMockSession({ payment_method_types: ["apple_pay", "card"] }),
        });
        const mixedProvider = document.createElement("bias-provider");
        mixedProvider.controller = mixed.core;
        const mixedExpress = document.createElement("bias-express-checkout-element");
        const mixedPayment = document.createElement("bias-payment-element");
        mixedProvider.append(mixedExpress, mixedPayment);
        document.body.append(walletProvider, mixedProvider);
        mixedExpress.showSeparator = true;
        await vi.waitFor(() =>
            expect(walletExpress.querySelector(".bias-applePayButton")).not.toBeNull(),
        );
        await vi.waitFor(() =>
            expect(mixedExpress.querySelector(".bias-applePayButton")).not.toBeNull(),
        );

        expect(walletExpress.querySelector(".bias-applePayButton")).not.toBeNull();
        expect(walletExpress.querySelector(".bias-expressCheckoutHeading")?.textContent).toBe(
            "Express checkout",
        );
        expect(walletPayment.textContent).not.toContain("There are no available payment methods");
        expect(walletPayment.querySelector(".bias-applePayButton")).toBeNull();
        expect(walletExpress.querySelector(".bias-expressCheckoutSeparator")).toBeNull();
        const mixedHeading = mixedExpress.querySelector(".bias-expressCheckoutHeading")!;
        const mixedButton = mixedExpress.querySelector(".bias-applePayButton")!;
        const separator = await vi.waitFor(() => {
            const current = mixedExpress.querySelector(".bias-expressCheckoutSeparator");
            expect(current).not.toBeNull();
            return current!;
        });
        const conventional = mixedPayment.querySelector(".bias-paymentMethodForm")!;
        expect(separator.textContent).toContain("or");
        expect(mixedHeading.compareDocumentPosition(mixedButton)).toBe(
            Node.DOCUMENT_POSITION_FOLLOWING,
        );
        expect(mixedButton.compareDocumentPosition(separator)).toBe(
            Node.DOCUMENT_POSITION_FOLLOWING,
        );
        expect(separator.compareDocumentPosition(conventional)).toBe(
            Node.DOCUMENT_POSITION_FOLLOWING,
        );
    });

    it("combines express disabled with the controller lock without disabling conventional methods", async () => {
        class MockApplePaySession {
            static STATUS_SUCCESS = 1;
            static STATUS_FAILURE = 0;
            static canMakePayments = vi.fn(() => true);
            constructor(_version: number, _request: unknown) {}
            begin() {}
            abort() {}
            completeMerchantValidation() {}
            completePayment() {}
        }
        vi.stubGlobal("ApplePaySession", MockApplePaySession);

        const controlled = fakeCore({
            applePay: true,
            session: createMockSession({
                payment_method_types: ["apple_pay", "card", "us_bank_account"],
            }),
        });
        const provider = document.createElement("bias-provider");
        provider.controller = controlled.core;
        const payment = document.createElement("bias-express-checkout-element");
        payment.setAttribute("disabled", "");
        const conventionalPayment = document.createElement("bias-payment-element");
        conventionalPayment.paymentMethodLayout = "radio";
        provider.append(payment, conventionalPayment);
        document.body.append(provider);

        await vi.waitFor(() =>
            expect(payment.querySelector(".bias-applePayButton")).not.toBeNull(),
        );
        const walletButton = payment.querySelector<HTMLButtonElement>(".bias-applePayButton")!;
        const conventionalButton =
            conventionalPayment.querySelector<HTMLButtonElement>("[role=radio]")!;
        expect(payment.disabled).toBe(true);
        expect(walletButton.disabled).toBe(true);
        expect(conventionalButton.disabled).toBe(false);

        payment.disabled = false;
        await vi.waitFor(() => expect(walletButton.disabled).toBe(false));

        controlled.update({
            ...controlled.core.getPublicState(),
            status: "submitting",
        });
        await vi.waitFor(() => expect(walletButton.disabled).toBe(true));
        expect(conventionalButton.disabled).toBe(true);
    });

    it("keeps Apple Pay hidden and unavailable when browser capability is false", async () => {
        class MockApplePaySession {
            static STATUS_SUCCESS = 1;
            static STATUS_FAILURE = 0;
            static canMakePayments = vi.fn(() => false);
            constructor(_version: number, _request: unknown) {}
            begin() {}
            abort() {}
            completeMerchantValidation() {}
            completePayment() {}
        }
        vi.stubGlobal("ApplePaySession", MockApplePaySession);
        const controlled = fakeCore({
            applePay: true,
            session: createMockSession({ payment_method_types: ["apple_pay"] }),
        });
        const provider = document.createElement("bias-provider");
        provider.controller = controlled.core;
        const payment = document.createElement("bias-express-checkout-element");
        provider.append(payment);
        document.body.append(provider);
        await vi.waitFor(() =>
            expect(controlled.setWalletAvailability).toHaveBeenCalledWith(
                "apple_pay",
                "unavailable",
            ),
        );

        expect(payment.querySelector(".bias-applePayButton")).toBeNull();
        expect(controlled.core.getPublicState().sessionState.status).toBe("ready");
    });

    it("begins Apple Pay synchronously, blocks duplicate clicks, and passes the token unchanged", async () => {
        const calls: string[] = [];
        const instances: MockApplePaySession[] = [];
        class MockApplePaySession {
            static STATUS_SUCCESS = 7;
            static STATUS_FAILURE = 8;
            static canMakePayments = vi.fn(() => true);
            static supportsVersion = vi.fn((version: number) => version <= 5);
            onvalidatemerchant: ((event: { validationURL: string }) => void) | null = null;
            onpaymentauthorized: ((event: any) => void) | null = null;
            oncancel: (() => void) | null = null;
            completed?: number;
            merchantSession?: unknown;
            constructor(
                public version: number,
                public request: unknown,
            ) {
                calls.push("construct");
                instances.push(this);
            }
            begin() {
                calls.push("begin");
            }
            abort() {
                calls.push("abort");
            }
            completeMerchantValidation(value: unknown) {
                this.merchantSession = value;
            }
            completePayment(value: number) {
                this.completed = value;
            }
        }
        vi.stubGlobal("ApplePaySession", MockApplePaySession);
        const controlled = fakeCore({
            applePay: true,
            session: createMockSession({ payment_method_types: ["apple_pay"] }),
        });
        controlled.beginApplePayPresentation.mockImplementation(() => {
            calls.push("lock");
            return {
                config: {
                    enabled: true,
                    country_code: "US",
                    currency_code: "USD",
                    supported_networks: ["visa"],
                    merchant_capabilities: ["supports3DS"],
                    display_name: "Bias Test",
                },
                checkoutSessionId: "cs_test_123",
                updatedAt: 1,
                amount: 5000,
                currency: "USD",
                requiresBillingContact: false,
                requiresEmail: false,
                requiresPhone: false,
                requiresShippingContact: false,
                shippingMethods: [],
            } as any;
        });
        const provider = document.createElement("bias-provider");
        provider.controller = controlled.core;
        const payment = document.createElement("bias-express-checkout-element");
        provider.append(payment);
        document.body.append(provider);
        await vi.waitFor(() =>
            expect(payment.querySelector(".bias-applePayButton")).not.toBeNull(),
        );

        const button = payment.querySelector<HTMLButtonElement>(".bias-applePayButton")!;
        button.click();
        button.click();
        expect(calls.slice(0, 3)).toEqual(["lock", "construct", "begin"]);
        expect(instances).toHaveLength(1);
        expect(instances[0]!.version).toBe(5);

        instances[0]!.onvalidatemerchant?.({ validationURL: "https://apple.example/validate" });
        await settle();
        expect(controlled.validateApplePayMerchant).toHaveBeenCalledWith(
            expect.anything(),
            "https://apple.example/validate",
            expect.any(AbortSignal),
        );
        expect(instances[0]!.merchantSession).toEqual({ merchantSessionIdentifier: "merchant" });

        const paymentData = {
            version: "EC_v1",
            data: "secret-token",
            signature: "signature",
            header: {
                ephemeralPublicKey: "key",
                publicKeyHash: "hash",
                transactionId: "transaction",
            },
        };
        instances[0]!.onpaymentauthorized?.({
            payment: { token: { paymentData }, billingContact: { givenName: "Ada" } },
        });
        await settle();
        expect(controlled.authorizeApplePay.mock.calls[0]?.[1]).toBe(paymentData);
        expect(instances[0]!.completed).toBe(MockApplePaySession.STATUS_SUCCESS);
        expect(JSON.stringify(controlled.core.getPublicState())).not.toContain("secret-token");

        controlled.authorizeApplePay.mockImplementationOnce(async () => {
            const error = Object.assign(new Error("Your card was declined."), {
                code: "payment_failed" as const,
                retryable: true,
            });
            controlled.update({
                ...controlled.core.getPublicState(),
                status: "failed",
                canSubmit: false,
                submissionError: error,
            });
            return "failure";
        });
        button.click();
        instances[1]!.onpaymentauthorized?.({
            payment: { token: { paymentData }, billingContact: undefined },
        });
        await settle();
        expect(instances[1]!.completed).toBe(MockApplePaySession.STATUS_FAILURE);
        expect(controlled.core.getPublicState().submissionError?.message).toBe(
            "Your card was declined.",
        );
        expect(payment.textContent).not.toContain("secret-token");
    });

    it("aborts authorized sheets on client configuration changes and unmount without unlocking them", async () => {
        const instances: MockApplePaySession[] = [];
        class MockApplePaySession {
            static STATUS_SUCCESS = 1;
            static STATUS_FAILURE = 0;
            static canMakePayments = vi.fn(() => true);
            onvalidatemerchant = null;
            onpaymentauthorized: ((event: any) => void) | null = null;
            oncancel = null;
            aborted = false;
            constructor(_version: number, _request: unknown) {
                instances.push(this);
            }
            begin() {}
            abort() {
                this.aborted = true;
            }
            completeMerchantValidation() {}
            completePayment() {}
        }
        vi.stubGlobal("ApplePaySession", MockApplePaySession);
        const initialSession = createMockSession({ payment_method_types: ["apple_pay"] });
        const controlled = fakeCore({ applePay: true, session: initialSession });
        const authorizationSignals: AbortSignal[] = [];
        controlled.authorizeApplePay.mockImplementation(
            (...args: any[]) =>
                new Promise((resolve) => {
                    const signal = args[4] as AbortSignal;
                    authorizationSignals.push(signal);
                    signal.addEventListener("abort", () => resolve("ambiguous"), { once: true });
                }),
        );
        const provider = document.createElement("bias-provider");
        provider.controller = controlled.core;
        const payment = document.createElement("bias-express-checkout-element");
        provider.append(payment);
        document.body.append(provider);
        await vi.waitFor(() =>
            expect(payment.querySelector(".bias-applePayButton")).not.toBeNull(),
        );

        const authorizeCurrentSheet = () => {
            payment.querySelector<HTMLButtonElement>(".bias-applePayButton")!.click();
            instances.at(-1)!.onpaymentauthorized?.({
                payment: { token: { paymentData: {} }, billingContact: undefined },
            });
        };
        authorizeCurrentSheet();
        controlled.setFrameKey("replacement-client-secret:https://api.example");
        await vi.waitFor(() => expect(instances[0]!.aborted).toBe(true));
        expect(authorizationSignals[0]?.aborted).toBe(true);
        expect(controlled.failApplePayPresentation).not.toHaveBeenCalled();

        await vi.waitFor(() =>
            expect(payment.querySelector(".bias-applePayButton")).not.toBeNull(),
        );
        authorizeCurrentSheet();
        payment.remove();
        await vi.waitFor(() => expect(instances[1]!.aborted).toBe(true));
        expect(authorizationSignals[1]?.aborted).toBe(true);
        expect(controlled.failApplePayPresentation).not.toHaveBeenCalled();
    });

    it("fails merchant validation and returns cancellation to idle with focus restored", async () => {
        const instances: MockApplePaySession[] = [];
        class MockApplePaySession {
            static STATUS_SUCCESS = 1;
            static STATUS_FAILURE = 0;
            static canMakePayments = vi.fn(() => true);
            onvalidatemerchant: ((event: { validationURL: string }) => void) | null = null;
            onpaymentauthorized = null;
            oncancel: (() => void) | null = null;
            constructor(_version: number, _request: unknown) {
                instances.push(this);
            }
            begin() {}
            abort() {}
            completeMerchantValidation() {}
            completePayment() {}
        }
        vi.stubGlobal("ApplePaySession", MockApplePaySession);
        const controlled = fakeCore({
            applePay: true,
            applePayValidationFails: true,
            session: createMockSession({ payment_method_types: ["apple_pay"] }),
        });
        const provider = document.createElement("bias-provider");
        provider.controller = controlled.core;
        const payment = document.createElement("bias-express-checkout-element");
        provider.append(payment);
        document.body.append(provider);
        await vi.waitFor(() =>
            expect(payment.querySelector(".bias-applePayButton")).not.toBeNull(),
        );

        const button = payment.querySelector<HTMLButtonElement>(".bias-applePayButton")!;
        button.click();
        instances[0]!.onvalidatemerchant?.({ validationURL: "https://apple.example/validate" });
        await settle();
        expect(controlled.failApplePayPresentation).toHaveBeenCalledWith(
            "Apple Pay could not be validated. Please try again.",
        );

        controlled.validateApplePayMerchant.mockResolvedValue({});
        button.click();
        instances[1]!.oncancel?.();
        await settle();
        expect(controlled.cancelWalletPresentation).toHaveBeenCalledWith("apple_pay");
        expect(document.activeElement).toBe(button);
    });

    it("initializes when vanilla configuration is assigned after connection", () => {
        const provider = document.createElement("bias-provider") as BiasProviderElement;
        document.body.append(provider);

        expect(provider.controller).toBeUndefined();
        provider.clientSecret = "cs_test_secret_123";
        expect(provider.controller).toBeDefined();
    });
});
