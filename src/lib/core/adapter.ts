import type { AddressAutocompleteSuggestion, CheckoutSession } from "@biaspay/sdk";
import type { BiasFieldStatus, FrameFieldType, ValueFieldType } from "./types";
import type {
    AddressMetadataState,
    AddressScope,
    Appearance,
    BiasElementsState,
    BiasFieldName,
    BiasFieldState,
    BiasFieldValidator,
    BiasFieldValueMap,
    PaymentMethod,
} from "./public-types";

export type ElementsConfig = {
    clientSecret: string;
    initialCheckoutSession?: CheckoutSession;
    apiBaseUrl?: string;
    frameUrl?: string;
    appearance?: Appearance;
    onComplete?: () => void;
};

export type InternalCollector =
    | { kind: "address"; scope: AddressScope; fields: ValueFieldType[] }
    | { kind: "contact"; fields?: readonly ["email"] };

export type InternalFrameBinding = {
    field: FrameFieldType;
    triggerValidation(): void;
    dispose?(): void;
};

export type InternalFrameStateBinding = {
    readonly state: BiasFieldStatus;
    readonly clientSecret: string;
    readonly frameUrl: string;
    /** Changes whenever frame/session ownership changes, including API-base changes. */
    readonly key: string;
    setState(state: Partial<BiasFieldStatus>): void;
    setEncryptedData(value: string | null): void;
};

export type InternalFieldBinding<K extends BiasFieldName> = {
    readonly state: BiasFieldState<BiasFieldValueMap[K]>;
    setValue(value: BiasFieldValueMap[K]): void;
    setValidator(validator: BiasFieldValidator<K>): () => void;
    validate(): void;
    onFocus(): void;
    onBlur(): void;
};

export interface ElementsController {
    getPublicState(): BiasElementsState;
    subscribe(listener: () => void): () => void;
    activate(): void;
    deactivate(): void;
    updateConfig(config: ElementsConfig): void;
    refreshSession(): void;
    setPaymentMethod(method: PaymentMethod): void;
    submit(): void;
    getField<K extends BiasFieldName>(name: K, scope?: AddressScope): InternalFieldBinding<K>;
    getFrame(field: FrameFieldType): InternalFrameStateBinding;
    autocompleteAddress(
        input: string,
        country: string | undefined,
        signal: AbortSignal,
    ): Promise<AddressAutocompleteSuggestion[]>;
    getBillingSameAsShipping(): boolean;
    setBillingSameAsShipping(value: boolean): void;
    hasCollector(kind: "contact" | "address", scope?: AddressScope): boolean;
    registerCollector(collector: InternalCollector): () => void;
    registerFrame(field: InternalFrameBinding): () => void;
    registerPaymentElement(method?: PaymentMethod): () => void;
    getAddressMetadata(scope: AddressScope): AddressMetadataState;
    getAddressMetadataForCountry(country: string): AddressMetadataState;
}
