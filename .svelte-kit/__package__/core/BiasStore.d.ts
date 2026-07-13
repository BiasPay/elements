import { type AddressAutocompleteSuggestion, type CheckoutSession } from "@biaspay/sdk";
export type { AddressAutocompleteSuggestion };
import type { AddressScope, BiasFieldStatus, FieldValueMap, FrameFieldType, PaymentMethodType, UnifiedFieldState, ValueFieldStatus, ValueFieldType, ValueFieldValidator } from "./types";
export declare const CARD_FRAME_FIELDS: readonly ["cardNumber", "cardExpiry", "cardCvc"];
export declare const CARD_VALUE_FIELDS: readonly ["country", "postalCode"];
export declare const BANK_FRAME_FIELDS: readonly ["bankAccountNumber", "bankRoutingNumber"];
export declare const ALL_FRAME_FIELDS: readonly ["cardNumber", "cardExpiry", "cardCvc", "bankAccountNumber", "bankRoutingNumber"];
export declare const BANK_VALUE_FIELDS: readonly ["name", "accountType", "country", "postalCode"];
/** Fields the address element always requires; it appends "phone" when collecting one. */
export declare const ADDRESS_VALUE_FIELDS: readonly ["name", "country", "addressLine1", "city", "state", "postalCode"];
export declare function initialFrameField(): BiasFieldStatus;
export declare function initialValueField<T extends string>(value?: T | "", valid?: boolean): ValueFieldStatus<T>;
export declare function createInitialFieldState(): UnifiedFieldState;
export type EncryptedFieldMap = Partial<Record<FrameFieldType, string | null>>;
export type BiasStoreState = {
    fieldState: UnifiedFieldState;
    selectedPaymentMethod: PaymentMethodType;
    encryptedFields: EncryptedFieldMap;
    submitLoading: boolean;
    submitSuccess: boolean;
    paymentError: string | null;
    /** True while a billing-scope address element is mounted. */
    collectsAddress: boolean;
    /** True while a shipping-scope address element is mounted. */
    collectsShipping: boolean;
    /** True while a contact details (email) element is mounted. */
    collectsContactDetails: boolean;
    /**
     * True when the billing address/details should be sourced from the
     * shipping fields instead of their own (billing's own field values are
     * kept but ignored while this is set, so unchecking restores them).
     */
    billingSameAsShipping: boolean;
};
export type BiasStoreMethods = {
    getState(): BiasStoreState;
    /** Cancel controller-owned background work without persisting pending values. */
    cancel(): void;
    setFrameFieldState(type: FrameFieldType, nextState: Partial<BiasFieldStatus>): void;
    onEncryptedData(field: FrameFieldType, encryptedValue: string | null): void;
    resetFrameFields(): void;
    /** Clear shopper/session-owned values before hydrating a different session. */
    resetSessionFields(): void;
    setFieldValue<K extends ValueFieldType>(type: K, value: FieldValueMap[K]): void;
    validateField<K extends ValueFieldType>(type: K): void;
    setValueFieldState<K extends ValueFieldType>(type: K, nextState: Partial<ValueFieldStatus<FieldValueMap[K]>>): void;
    registerFieldValidator<K extends ValueFieldType>(type: K, validator: ValueFieldValidator<K>): void;
    unregisterFieldValidator(type: ValueFieldType): void;
    setSelectedPaymentMethod(method: PaymentMethodType): void;
    /**
     * Registers the address value fields collected by a mounted address element
     * for a given scope (pass null to unregister). `fields` are the logical field
     * types (e.g. "name", "addressLine1"); they are resolved to the scope's
     * concrete slots internally. While registered, these fields are required in
     * addition to the selected payment method's fields. A "billing" address is
     * included in the payment method's billing_details; a "shipping" address is
     * written to the checkout session's shipping details instead.
     */
    setAddressFields(scope: AddressScope, fields: readonly ValueFieldType[] | null): void;
    /**
     * Registers whether a contact details element is mounted (pass false to
     * unregister). While registered, "email" is required in addition to the
     * selected payment method's fields, and the email is persisted to the
     * checkout session's customer_details when the payment is submitted.
     */
    setContactDetailsFields(collects: boolean): void;
    /**
     * Set whether the billing address/details should be sourced from the
     * shipping scope instead of billing's own fields. Billing's own field
     * values are left untouched so unchecking restores them.
     */
    setBillingSameAsShipping(value: boolean): void;
    /**
     * IP-geolocate the shopper (ipinfo.io) and use the result as the default
     * country and state. Only fields the user hasn't touched are updated, and
     * failures are silent. Runs at most once per store.
     */
    applyGeoDefaults(): Promise<void>;
    /**
     * Seed email/shipping fields from a fetched checkout session (e.g. values
     * saved by a previous autosave). Only fields the user hasn't touched are
     * updated, and this never itself triggers an autosave.
     */
    hydrateFromSession(session: CheckoutSession): void;
    /**
     * Fetch address autocomplete suggestions for free-text input. Returns an
     * empty array on failure (including abort) so callers don't need to
     * distinguish "no results" from "errored".
     */
    autocompleteAddress(input: string, country: string | undefined, signal: AbortSignal): Promise<AddressAutocompleteSuggestion[]>;
    getRequiredFrameFields(): readonly FrameFieldType[];
    getRequiredValueFields(): ValueFieldType[];
    isSubmittable(): boolean;
    attemptPayment(opts: {
        triggerFrameValidation(type: FrameFieldType): void;
    }): void;
    setApiBaseUrl(url: string | undefined): void;
};
export type BiasStoreOptions = {
    clientSecret: () => string;
    apiBaseUrl?: string;
    /** Called whenever any state changes. Framework wires reactivity here. */
    onChange(state: BiasStoreState): void;
    /** Called once when payment succeeds. */
    onComplete?(): void;
};
export declare function createBiasStore(options: BiasStoreOptions): BiasStoreMethods;
