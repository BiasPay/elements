import type { ApplePayPaymentData, CheckoutSession, CheckoutSessionExpand } from "@biaspay/sdk";
import type {
    AddressAutocompleteSuggestion,
    AddressValidationResult,
    ApplePayWalletConfiguration,
} from "./api-types";
import type { BiasFieldStatus, ContactFieldType, FrameFieldType, ValueFieldType } from "./types";
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
    SavedPaymentMethod,
    WalletAvailabilityStatus,
    WalletPaymentMethod,
    ShopperCheckoutSessionUpdateParams,
} from "./public-types";

export type ElementsConfig = {
    clientSecret: string;
    initialCheckoutSession?: CheckoutSession;
    /** Shows `initialCheckoutSession` without contacting the Bias API. Submitting does nothing. */
    preview?: boolean;
    checkoutSessionExpand?: CheckoutSessionExpand;
    defaultValues?: Partial<BiasFieldValueMap>;
    rememberDetails?: boolean;
    savedPaymentMethods?: readonly SavedPaymentMethod[];
    apiBaseUrl?: string;
    frameUrl?: string;
    appearance?: Appearance;
    onComplete?: () => void;
};

export type InternalCollector =
    | { kind: "address"; scope: AddressScope; fields: ValueFieldType[] }
    | { kind: "contact"; fields: readonly ContactFieldType[] };

export type AddressVerificationState =
    | { status: "idle" }
    | { status: "verifying" }
    | { status: "verified"; result: AddressValidationResult };

export type ApplePayWalletConfig = ApplePayWalletConfiguration;

export type ApplePayShippingMethod = {
    readonly identifier: string;
    readonly label: string;
    readonly detail: string;
    readonly amount: number;
};

export type ApplePayPresentation = {
    readonly config: ApplePayWalletConfig;
    readonly checkoutSessionId: string;
    updatedAt: number;
    amount: number;
    readonly currency: string;
    readonly requiresBillingContact: boolean;
    readonly requiresEmail: boolean;
    readonly requiresPhone: boolean;
    readonly requiresShippingContact: boolean;
    shippingMethods: readonly ApplePayShippingMethod[];
    selectedShippingRate?: string;
};

export type ApplePayContact = {
    readonly givenName?: string;
    readonly familyName?: string;
    readonly emailAddress?: string;
    readonly phoneNumber?: string;
    readonly addressLines?: readonly string[];
    readonly locality?: string;
    readonly administrativeArea?: string;
    readonly postalCode?: string;
    readonly countryCode?: string;
};

export type ApplePayPresentationUpdate = {
    readonly amount: number;
    readonly shippingMethods: readonly ApplePayShippingMethod[];
};

export type ApplePayAuthorizationResult = "success" | "failure" | "ambiguous";

export type InternalFrameBinding = {
    field: FrameFieldType;
    triggerValidation(): void;
    dispose?(): void;
};

export type InternalFrameStateBinding = {
    readonly state: BiasFieldStatus;
    readonly clientSecret: string;
    readonly frameUrl: string;
    readonly preview?: boolean;
    /** Changes whenever frame/session ownership changes, including API-base changes. */
    readonly key: string;
    /** Scopes cross-field frame coordination (e.g. card brand) to this checkout instance. */
    readonly group?: string;
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
    updateCheckoutSession(params: ShopperCheckoutSessionUpdateParams): Promise<CheckoutSession>;
    applyDiscountCode(
        code: string,
        synchronize?: (session: CheckoutSession) => void | Promise<void>,
    ): Promise<boolean>;
    removeDiscountCode(
        discountId: string,
        synchronize?: (session: CheckoutSession) => void | Promise<void>,
    ): Promise<boolean>;
    clearDiscountCodeError(): void;
    retryDetailsSave(): void;
    setPaymentMethod(method: PaymentMethod): void;
    setSavedPaymentMethod(id: string): void;
    /** @internal Updated by wallet renderers after browser capability detection. */
    setWalletAvailability(method: WalletPaymentMethod, status: WalletAvailabilityStatus): void;
    /** @internal Starts wallet presentation without exposing a merchant-facing API. */
    beginWalletPresentation(method: WalletPaymentMethod): boolean;
    /** @internal Returns a cancelled wallet presentation to idle. */
    cancelWalletPresentation(method: WalletPaymentMethod): void;
    /** @internal Preloads server-side Apple Pay configuration. */
    prepareApplePay(signal?: AbortSignal): Promise<ApplePayWalletConfig | null>;
    /** @internal Atomically locks and snapshots canonical checkout values for presentation. */
    beginApplePayPresentation(): ApplePayPresentation | null;
    /** @internal Performs Apple merchant validation for the active presentation. */
    validateApplePayMerchant(
        presentation: ApplePayPresentation,
        validationUrl: string,
        signal?: AbortSignal,
    ): Promise<Record<string, unknown>>;
    /** @internal Reprices checkout from Apple's redacted shipping contact. */
    updateApplePayShippingContact(
        presentation: ApplePayPresentation,
        shippingContact: ApplePayContact,
        signal?: AbortSignal,
    ): Promise<ApplePayPresentationUpdate>;
    /** @internal Selects and reprices an Apple shipping method. */
    updateApplePayShippingMethod(
        presentation: ApplePayPresentation,
        shippingRate: string,
        signal?: AbortSignal,
    ): Promise<ApplePayPresentationUpdate>;
    /** @internal Persists final contacts, then submits an opaque token without exposing it as state. */
    authorizeApplePay(
        presentation: ApplePayPresentation,
        paymentData: ApplePayPaymentData,
        billingContact?: ApplePayContact,
        shippingContact?: ApplePayContact,
        signal?: AbortSignal,
    ): Promise<ApplePayAuthorizationResult>;
    /** @internal Fails and unlocks a definite Apple Pay presentation error. */
    failApplePayPresentation(message?: string): void;
    clearRememberedDetails(): void;
    submit(): void;
    getField<K extends BiasFieldName>(name: K, scope?: AddressScope): InternalFieldBinding<K>;
    getFrame(field: FrameFieldType): InternalFrameStateBinding;
    autocompleteAddress(
        input: string,
        country: string | undefined,
        signal: AbortSignal,
    ): Promise<AddressAutocompleteSuggestion[]>;
    getAddressVerification(scope: AddressScope): AddressVerificationState;
    verifyAddress(scope: AddressScope): Promise<AddressValidationResult | null>;
    getBillingSameAsShipping(): boolean;
    setBillingSameAsShipping(value: boolean): void;
    /** Whether a collector of this kind (and scope) is mounted, optionally one collecting `field`. */
    hasCollector(
        kind: "contact" | "address",
        scope?: AddressScope,
        field?: ValueFieldType,
    ): boolean;
    registerCollector(collector: InternalCollector): () => void;
    registerFrame(field: InternalFrameBinding): () => void;
    registerPaymentElement(method?: PaymentMethod): () => void;
    registerSubmitButton(): () => void;
    hasSubmitButton(): boolean;
    getAddressMetadata(scope: AddressScope): AddressMetadataState;
    getAddressMetadataForCountry(country: string): AddressMetadataState;
}
