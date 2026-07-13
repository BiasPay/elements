import type { AddressAutocompleteSuggestion, CheckoutSession } from "@biaspay/sdk";
import { type AddressScope, type Appearance, type BiasElementsState, type BiasFieldName, type ElementsConfig, type ElementsController, type FrameFieldType, type InternalCollector, type PaymentMethod, type ValueFieldType } from "./core";
export type BiasProviderConfig = ElementsConfig;
export type BiasContextValue = BiasController;
/** Reactive private renderer veneer over the deliberately narrow Core adapter. */
export declare class BiasController {
    readonly core: ElementsController;
    private readonly track;
    static fromCore(core: ElementsController): BiasController;
    constructor(config: BiasProviderConfig);
    constructor(source: {
        core: ElementsController;
    });
    get publicState(): BiasElementsState;
    get sessionState(): import("./core").SessionState;
    get checkoutSession(): CheckoutSession | undefined;
    get sessionLoading(): boolean;
    get submitDisabled(): boolean;
    get isSubmittable(): boolean;
    get sessionKey(): string;
    get clientSecret(): string;
    get frameUrl(): string;
    get snapshot(): {
        selectedPaymentMethod: PaymentMethod | undefined;
        submitLoading: boolean;
        submitSuccess: boolean;
        paymentError: string | null;
        collectsShipping: boolean;
        collectsAddress: boolean;
        billingSameAsShipping: boolean;
    };
    get fieldState(): Record<string, any>;
    activate(): void;
    deactivate(): void;
    updateConfig(next: BiasProviderConfig): void;
    attemptPayment(): void;
    setPaymentMethod(method: PaymentMethod): void;
    registerCollector(collector: InternalCollector): () => void;
    registerPaymentElement(method?: PaymentMethod): () => void;
    addressMetadata(scope: AddressScope): import("./core").AddressMetadata;
    getBillingSameAsShipping(): boolean;
    setBillingSameAsShipping(value: boolean): void;
    hasCollector(kind: "contact" | "address", scope?: AddressScope): boolean;
    autocompleteAddress(input: string, country: string | undefined, signal: AbortSignal): Promise<AddressAutocompleteSuggestion[]>;
    getField(scope: AddressScope, name: ValueFieldType): {
        readonly value: string;
        readonly state: {
            focused: boolean;
            valid: boolean;
            value: string;
            isFocused: boolean;
            isValid: boolean;
            error: string | null;
        };
        setValue: (value: string) => void;
        setState(next: {
            focused?: boolean;
            error?: string | null;
        }): void;
        validate: () => void;
        setValidator: (validator: import("./core").BiasFieldValidator<BiasFieldName>) => () => void;
    };
}
export declare function createBiasContextMap(controller: BiasContextValue, scope?: AddressScope, getAppearance?: () => Appearance | undefined): Map<symbol, unknown>;
export declare function setBiasContext(controller: BiasController): void;
export declare function getBiasContext(): BiasController;
export declare function setAddressScope(getScope: () => AddressScope): void;
export declare function getAddressScope(): AddressScope;
export declare function setAppearanceContext(getAppearance: () => Appearance | undefined): void;
export declare function getAppearanceContext(): Appearance | undefined;
export type { AddressAutocompleteSuggestion, AddressScope, Appearance, CheckoutSession, FrameFieldType, PaymentMethod, };
