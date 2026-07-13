import { getContext, setContext } from "svelte";
import { createSubscriber } from "svelte/reactivity";
import type { AddressAutocompleteSuggestion, CheckoutSession } from "@biaspay/sdk";
import {
    BiasController as CoreBiasController,
    type AddressScope,
    type Appearance,
    type BiasElementsState,
    type BiasFieldName,
    type ElementsConfig,
    type ElementsController,
    type FrameFieldType,
    type InternalCollector,
    type PaymentMethod,
    type ValueFieldType,
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
        return status === "submitting" || status === "succeeded";
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
            submitLoading: state.status === "submitting",
            submitSuccess: state.status === "succeeded",
            paymentError: state.submissionError?.message ?? null,
            collectsShipping: this.hasCollector("address", "shipping"),
            collectsAddress: this.hasCollector("address", "billing"),
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
            "email",
            "name",
            "addressLine1",
            "addressLine2",
            "city",
            "state",
            "phone",
            "shippingCountry",
            "shippingPostalCode",
            "shippingName",
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
    registerCollector(collector: InternalCollector) {
        return this.core.registerCollector(collector);
    }
    registerPaymentElement(method?: PaymentMethod) {
        return this.core.registerPaymentElement(method);
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
    hasCollector(kind: "contact" | "address", scope?: AddressScope) {
        this.track();
        return this.core.hasCollector(kind, scope);
    }
    autocompleteAddress(
        input: string,
        country: string | undefined,
        signal: AbortSignal,
    ): Promise<AddressAutocompleteSuggestion[]> {
        return this.core.autocompleteAddress(input, country, signal);
    }

    getField(scope: AddressScope, name: ValueFieldType) {
        const addressNames: ValueFieldType[] = [
            "country",
            "postalCode",
            "name",
            "addressLine1",
            "addressLine2",
            "city",
            "state",
            "phone",
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

export type {
    AddressAutocompleteSuggestion,
    AddressScope,
    Appearance,
    CheckoutSession,
    FrameFieldType,
    PaymentMethod,
};
