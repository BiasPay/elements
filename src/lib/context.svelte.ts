import { getContext, setContext } from "svelte";
import { createSubscriber } from "svelte/reactivity";
import type { ApplePayPaymentData, CheckoutSession } from "@biaspay/sdk";
import type { AddressAutocompleteSuggestion } from "./core/api-types";
import {
    BiasController as CoreBiasController,
    type AddressScope,
    type ApplePayContact,
    type ApplePayPresentation,
    type ApplePayPresentationUpdate,
    type Appearance,
    type BiasElementsState,
    type BiasFieldName,
    type ElementsConfig,
    type ElementsController,
    type FrameFieldType,
    type InternalCollector,
    type PaymentMethod,
    type ShopperCheckoutSessionUpdateParams,
    type ValueFieldType,
    PAYMENT_PROCESSING_MESSAGE,
    setupMessage,
} from "~/core";

export type BiasProviderConfig = ElementsConfig;
export type BiasContextValue = BiasController;

const BIAS_KEY = Symbol("bias-context");
const SCOPE_KEY = Symbol("bias-address-scope");
const APPEARANCE_KEY = Symbol("bias-appearance");
type AddressScopeSource = { readonly current: AddressScope };
type AppearanceSource = { readonly current: Appearance | undefined };

/** Reactive private renderer veneer over the deliberately narrow Core adapter. */
export class BiasController {
    readonly core: ElementsController;
    private readonly track: () => void;

    static fromCore(core: ElementsController): BiasController {
        return new BiasController({ core });
    }

    constructor(config: BiasProviderConfig);
    constructor(source: { core: ElementsController });
    constructor(source: BiasProviderConfig | { core: ElementsController }) {
        this.core = "core" in source ? source.core : new CoreBiasController(source);
        this.track = createSubscriber((update) => this.core.subscribe(update));
    }

    get publicState(): BiasElementsState {
        this.track();
        return this.core.getPublicState();
    }

    get sessionState() {
        return this.publicState.sessionState;
    }

    get checkoutSession(): CheckoutSession | undefined {
        const state = this.sessionState;
        return "session" in state ? state.session : undefined;
    }

    get sessionLoading(): boolean {
        return this.sessionState.status === "idle" || this.sessionState.status === "loading";
    }

    get submitDisabled(): boolean {
        const status = this.publicState.status;
        return status === "submitting" || status === "processing" || status === "succeeded";
    }

    get isSubmittable(): boolean {
        return this.publicState.canSubmit;
    }

    get sessionKey(): string {
        this.track();
        return this.core.getFrame("cardNumber").key;
    }

    get clientSecret(): string {
        this.track();
        return this.core.getFrame("cardNumber").clientSecret;
    }
    get frameUrl(): string {
        this.track();
        return this.core.getFrame("cardNumber").frameUrl;
    }

    get snapshot() {
        const state = this.publicState;
        return {
            selectedPaymentMethod: state.paymentMethod,
            selectedSavedPaymentMethod: state.savedPaymentMethod,
            savedPaymentMethods: state.savedPaymentMethods,
            submitLoading: state.status === "submitting",
            submitSuccess: state.status === "succeeded",
            submitDisabled:
                state.status === "submitting" ||
                state.status === "processing" ||
                state.status === "succeeded",
            paymentError:
                state.status === "processing"
                    ? this.checkoutSession?.mode === "setup"
                        ? setupMessage(PAYMENT_PROCESSING_MESSAGE)!
                        : PAYMENT_PROCESSING_MESSAGE
                    : (state.submissionError?.message ?? null),
            collectsShipping: this.hasCollector("address", "shipping"),
            collectsAddress: this.hasCollector("address", "billing", "addressLine1"),
            billingSameAsShipping: this.getBillingSameAsShipping(),
        };
    }

    get fieldState(): Record<string, any> {
        this.track();
        const result: Record<string, any> = {};
        const fields: BiasFieldName[] = [
            "country",
            "postalCode",
            "accountType",
            "accountHolderType",
            "email",
            "phone",
            "name",
            "firstName",
            "lastName",
            "addressLine1",
            "addressLine2",
            "city",
            "state",
            "shippingCountry",
            "shippingPostalCode",
            "shippingFirstName",
            "shippingLastName",
            "shippingAddressLine1",
            "shippingAddressLine2",
            "shippingCity",
            "shippingState",
            "shippingPhone",
        ];
        for (const name of fields) {
            const binding = this.core.getField(name);
            result[name] = {
                ...binding.state,
                focused: binding.state.isFocused,
                valid: binding.state.isValid,
            };
        }
        for (const name of [
            "cardNumber",
            "cardExpiry",
            "cardCvc",
            "bankRoutingNumber",
            "bankAccountNumber",
        ] as const) {
            result[name] = this.core.getFrame(name).state;
        }
        return result;
    }

    activate() {
        this.core.activate();
    }
    deactivate() {
        this.core.deactivate();
    }
    updateConfig(next: BiasProviderConfig) {
        this.core.updateConfig(next);
    }
    attemptPayment() {
        this.core.submit();
    }
    setPaymentMethod(method: PaymentMethod) {
        this.core.setPaymentMethod(method);
    }
    setSavedPaymentMethod(id: string) {
        this.core.setSavedPaymentMethod(id);
    }
    setWalletAvailability(status: "loading" | "available" | "unavailable") {
        this.core.setWalletAvailability("apple_pay", status);
    }
    prepareApplePay(signal?: AbortSignal) {
        return this.core.prepareApplePay(signal);
    }
    beginApplePayPresentation() {
        return this.core.beginApplePayPresentation();
    }
    validateApplePayMerchant(
        presentation: ApplePayPresentation,
        validationUrl: string,
        signal?: AbortSignal,
    ) {
        return this.core.validateApplePayMerchant(presentation, validationUrl, signal);
    }
    updateApplePayShippingContact(
        presentation: ApplePayPresentation,
        contact: ApplePayContact,
        signal?: AbortSignal,
    ): Promise<ApplePayPresentationUpdate> {
        return this.core.updateApplePayShippingContact(presentation, contact, signal);
    }
    updateApplePayShippingMethod(
        presentation: ApplePayPresentation,
        shippingRate: string,
        signal?: AbortSignal,
    ): Promise<ApplePayPresentationUpdate> {
        return this.core.updateApplePayShippingMethod(presentation, shippingRate, signal);
    }
    authorizeApplePay(
        presentation: ApplePayPresentation,
        paymentData: ApplePayPaymentData,
        billingContact?: ApplePayContact,
        shippingContact?: ApplePayContact,
        signal?: AbortSignal,
    ) {
        return this.core.authorizeApplePay(
            presentation,
            paymentData,
            billingContact,
            shippingContact,
            signal,
        );
    }
    cancelApplePayPresentation() {
        this.core.cancelWalletPresentation("apple_pay");
    }
    failApplePayPresentation(message?: string) {
        this.core.failApplePayPresentation(message);
    }
    clearRememberedDetails() {
        this.core.clearRememberedDetails();
    }
    updateCheckoutSession(params: ShopperCheckoutSessionUpdateParams) {
        return this.core.updateCheckoutSession(params);
    }
    applyDiscountCode(
        code: string,
        synchronize?: (session: CheckoutSession) => void | Promise<void>,
    ) {
        return this.core.applyDiscountCode(code, synchronize);
    }
    removeDiscountCode(
        discountId: string,
        synchronize?: (session: CheckoutSession) => void | Promise<void>,
    ) {
        return this.core.removeDiscountCode(discountId, synchronize);
    }
    clearDiscountCodeError() {
        this.core.clearDiscountCodeError();
    }
    registerCollector(collector: InternalCollector) {
        return this.core.registerCollector(collector);
    }
    registerPaymentElement(method?: PaymentMethod) {
        return this.core.registerPaymentElement(method);
    }
    registerSubmitButton() {
        return this.core.registerSubmitButton();
    }
    get hasSubmitButton(): boolean {
        this.track();
        return this.core.hasSubmitButton();
    }
    addressMetadata(scope: AddressScope) {
        this.track();
        return this.core.getAddressMetadata(scope).metadata;
    }
    getBillingSameAsShipping() {
        this.track();
        return this.core.getBillingSameAsShipping();
    }
    setBillingSameAsShipping(value: boolean) {
        this.core.setBillingSameAsShipping(value);
    }
    hasCollector(kind: "contact" | "address", scope?: AddressScope, field?: ValueFieldType) {
        this.track();
        return this.core.hasCollector(kind, scope, field);
    }
    autocompleteAddress(
        input: string,
        country: string | undefined,
        signal: AbortSignal,
    ): Promise<AddressAutocompleteSuggestion[]> {
        return this.core.autocompleteAddress(input, country, signal);
    }
    addressVerification(scope: AddressScope) {
        this.track();
        return this.core.getAddressVerification(scope);
    }
    verifyAddress(scope: AddressScope) {
        return this.core.verifyAddress(scope);
    }

    getField(scope: AddressScope, name: ValueFieldType) {
        const addressNames: ValueFieldType[] = [
            "country",
            "postalCode",
            "firstName",
            "lastName",
            "addressLine1",
            "addressLine2",
            "city",
            "state",
        ];
        const publicName =
            scope === "shipping" && addressNames.includes(name)
                ? (`shipping${name[0]!.toUpperCase()}${name.slice(1)}` as BiasFieldName)
                : (name as BiasFieldName);
        const binding = this.core.getField(publicName, scope);
        this.track();
        return {
            get value() {
                return binding.state.value;
            },
            get state() {
                return {
                    ...binding.state,
                    focused: binding.state.isFocused,
                    valid: binding.state.isValid,
                };
            },
            setValue: binding.setValue,
            setState(next: { focused?: boolean; error?: string | null }) {
                if (next.focused === true) binding.onFocus();
                if (next.focused === false) binding.onBlur();
            },
            validate: binding.onBlur,
            setValidator: binding.setValidator,
        };
    }
}

export function createBiasContextMap(
    controller: BiasContextValue,
    scope?: AddressScope,
    getAppearance?: () => Appearance | undefined,
): Map<symbol, unknown> {
    const context = new Map<symbol, unknown>([[BIAS_KEY, controller]]);
    if (scope) context.set(SCOPE_KEY, { current: scope } satisfies AddressScopeSource);
    if (getAppearance) {
        context.set(APPEARANCE_KEY, {
            get current() {
                return getAppearance();
            },
        } satisfies AppearanceSource);
    }
    return context;
}

export function setBiasContext(controller: BiasController): void {
    setContext(BIAS_KEY, controller);
}
export function getBiasContext(): BiasController {
    const controller = getContext<BiasController | undefined>(BIAS_KEY);
    if (!controller) throw new Error("Bias components must be used within <BiasProvider>");
    return controller;
}

export function setAddressScope(getScope: () => AddressScope): void {
    setContext<AddressScopeSource>(SCOPE_KEY, {
        get current() {
            return getScope();
        },
    });
}
export function getAddressScope(): AddressScope {
    return getContext<AddressScopeSource | undefined>(SCOPE_KEY)?.current ?? "billing";
}
export function setAppearanceContext(getAppearance: () => Appearance | undefined): void {
    setContext<AppearanceSource>(APPEARANCE_KEY, {
        get current() {
            return getAppearance();
        },
    });
}
export function getAppearanceContext(): Appearance | undefined {
    return getContext<AppearanceSource | undefined>(APPEARANCE_KEY)?.current;
}
/** Like {@link getAppearanceContext}, but readable later, e.g. inside an effect. */
export function getAppearanceAccessor(): () => Appearance | undefined {
    const source = getContext<AppearanceSource | undefined>(APPEARANCE_KEY);
    return () => source?.current;
}

export type {
    AddressAutocompleteSuggestion,
    AddressScope,
    Appearance,
    CheckoutSession,
    FrameFieldType,
    PaymentMethod,
};
