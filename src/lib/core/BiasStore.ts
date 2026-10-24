import {
    Bias,
    type CheckoutSession,
    type CheckoutSessionUpdateParams,
    type CountryCode,
    type Error as ApiError,
    type PaymentCreateParams,
} from "@biaspay/sdk-checkout";
import type { AddressAutocompleteSuggestion, AddressValidationResult } from "./api-types";

export type { AddressAutocompleteSuggestion };
import { COUNTRY_NAMES, loadAddressMetadata, resolveAddressMetadata } from "./address-metadata";
import { createAutosaver } from "./autosave";
import {
    bankAccountMandate,
    SUBSCRIPTION_TERMS_CHANGED_MESSAGE,
    subscriptionTerms,
} from "./consent";
import {
    CHECKOUT_TOTALS_CHANGED_MESSAGE,
    PAYMENT_NOT_COMPLETED_MESSAGE,
    elementsError,
} from "./errors";
import { detectGeoLocation } from "./geo";
import { checkoutAmountRemaining, subscriptionFreeToday } from "./payable";
import {
    classifyPaymentStatus,
    createIdempotencyKey,
    describePaymentError,
    classifyIdempotencyError,
    failedPaymentMessage,
    PAYMENT_UNCONFIRMED_MESSAGE,
    sessionPaymentIds,
    shopperErrorMessage,
    type ObservedPayment,
    type PaymentAttempt,
    type PaymentFailure,
} from "./payment-outcome";
import type { BiasElementsError, DetailsSaveState, SavedPaymentMethod } from "./public-types";
import type { AddressVerificationState } from "./adapter";
import type {
    AddressScope,
    BiasFieldStatus,
    ContactFieldType,
    FieldValueMap,
    FrameFieldType,
    PaymentMethodType,
    UnifiedFieldState,
    ValueFieldStatus,
    ValueFieldType,
    ValueFieldValidationOptions,
    ValueFieldValidator,
} from "./types";
import { scopedField } from "./types";
import { getFieldValidation } from "./validation";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CARD_FRAME_FIELDS = [
    "cardNumber",
    "cardExpiry",
    "cardCvc",
] as const satisfies readonly FrameFieldType[];
export const CARD_VALUE_FIELDS = [
    "country",
    "postalCode",
] as const satisfies readonly ValueFieldType[];
export const BANK_FRAME_FIELDS = [
    "bankAccountNumber",
    "bankRoutingNumber",
] as const satisfies readonly FrameFieldType[];
export const ALL_FRAME_FIELDS = [
    ...CARD_FRAME_FIELDS,
    ...BANK_FRAME_FIELDS,
] as const satisfies readonly FrameFieldType[];
export const BANK_VALUE_FIELDS = [
    "name",
    "accountType",
    "accountHolderType",
    "country",
    "postalCode",
] as const satisfies readonly ValueFieldType[];
/** Fields every address element requires. */
export const ADDRESS_VALUE_FIELDS = [
    "firstName",
    "lastName",
    "country",
    "addressLine1",
    "city",
    "state",
    "postalCode",
] as const satisfies readonly ValueFieldType[];
const AUTOSAVE_DELAY = 350;
const ADDRESS_VERIFICATION_TIMEOUT_MS = 4_000;

function fullName(firstName: string, lastName: string): string | null {
    const value = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    return value || null;
}

function splitFullName(value: string) {
    const [firstName = "", ...lastName] = value.trim().split(/\s+/);
    return { firstName, lastName: lastName.join(" ") };
}

// ---------------------------------------------------------------------------
// Initial state factories
// ---------------------------------------------------------------------------

export function initialFrameField(): BiasFieldStatus {
    return {
        loading: true,
        focused: false,
        empty: true,
        valid: false,
        error: null,
        cardBrand: null,
    };
}

export function initialValueField<T extends string>(
    value: T | "" = "" as T | "",
    valid = false,
): ValueFieldStatus<T> {
    return { value: value as T, focused: false, valid, error: null };
}

export function createInitialFieldState(): UnifiedFieldState {
    return {
        cardNumber: initialFrameField(),
        cardExpiry: initialFrameField(),
        cardCvc: initialFrameField(),
        bankAccountNumber: initialFrameField(),
        bankRoutingNumber: initialFrameField(),
        country: initialValueField("US", true),
        postalCode: initialValueField(),
        accountType: initialValueField<"checking" | "savings">("checking", true),
        accountHolderType: initialValueField<"individual" | "company">("individual", true),
        email: initialValueField(),
        phone: initialValueField(),
        name: initialValueField(),
        firstName: initialValueField(),
        lastName: initialValueField(),
        addressLine1: initialValueField(),
        // Optional fields start valid so an untouched form can still submit
        addressLine2: initialValueField("", true),
        city: initialValueField(),
        state: initialValueField(),
        shippingCountry: initialValueField("US", true),
        shippingPostalCode: initialValueField(),
        shippingFirstName: initialValueField(),
        shippingLastName: initialValueField(),
        shippingAddressLine1: initialValueField(),
        shippingAddressLine2: initialValueField("", true),
        shippingCity: initialValueField(),
        shippingState: initialValueField(),
        shippingPhone: initialValueField("", true),
    };
}

/** Country field slot for a scope; used to resolve country-scoped validation. */
function countryFieldForScope(scope: AddressScope): ValueFieldType {
    return scope === "shipping" ? "shippingCountry" : "country";
}

/** Whether a field belongs to the shipping scope. */
function isShippingField(type: ValueFieldType): boolean {
    return typeof type === "string" && type.startsWith("shipping");
}

// ---------------------------------------------------------------------------
// BiasStore
// ---------------------------------------------------------------------------

export type EncryptedFieldMap = Partial<Record<FrameFieldType, string | null>>;

export type PaymentSelection =
    | { kind: "new"; method: PaymentMethodType }
    | { kind: "saved"; method: SavedPaymentMethod };

export type BiasStoreState = {
    fieldState: UnifiedFieldState;
    detailsSaveState: DetailsSaveState;
    paymentSelection: PaymentSelection;
    encryptedFields: EncryptedFieldMap;
    submitLoading: boolean;
    submitSuccess: boolean;
    paymentError: string | null;
    /** True while a billing-scope address element is mounted. */
    collectsAddress: boolean;
    /** True while a shipping-scope address element is mounted. */
    collectsShipping: boolean;
    /** True while a contact details element is mounted. */
    collectsContactDetails: boolean;
    /**
     * True when the billing address/details should be sourced from the
     * shipping fields instead of their own (billing's own field values are
     * kept but ignored while this is set, so unchecking restores them).
     */
    billingSameAsShipping: boolean;
    addressVerification: Record<AddressScope, AddressVerificationState>;
};

export type BiasStoreMethods = {
    getState(): BiasStoreState;
    /** Cancel controller-owned background work without persisting pending values. */
    cancel(): void;

    // Frame fields
    setFrameFieldState(type: FrameFieldType, nextState: Partial<BiasFieldStatus>): void;
    onEncryptedData(field: FrameFieldType, encryptedValue: string | null): void;
    resetFrameFields(): void;
    /** Clear shopper/session-owned values before hydrating a different session. */
    resetSessionFields(): void;

    // Value fields
    setFieldValue<K extends ValueFieldType>(type: K, value: FieldValueMap[K]): void;
    validateField<K extends ValueFieldType>(type: K): void;
    setValueFieldState<K extends ValueFieldType>(
        type: K,
        nextState: Partial<ValueFieldStatus<FieldValueMap[K]>>,
    ): void;

    // Validators
    registerFieldValidator<K extends ValueFieldType>(
        type: K,
        validator: ValueFieldValidator<K>,
    ): void;
    unregisterFieldValidator(type: ValueFieldType): void;

    // Payment method
    setSelectedPaymentMethod(method: PaymentMethodType): void;
    setSelectedSavedPaymentMethod(method: SavedPaymentMethod): void;

    // Address element
    /**
     * Registers the address value fields collected by a mounted address element
     * for a given scope (pass null to unregister). `fields` are the logical field
     * types (e.g. "firstName", "addressLine1"); they are resolved to the scope's
     * concrete slots internally. While registered, these fields are required in
     * addition to the selected payment method's fields. A "billing" address is
     * included in the payment method's billing_details; a "shipping" address is
     * written to the checkout session's shipping details instead.
     */
    setAddressFields(scope: AddressScope, fields: readonly ValueFieldType[] | null): void;

    // Contact details element
    /**
     * Registers the contact fields collected by mounted contact details elements
     * (pass null to unregister). While registered, these fields are required in
     * addition to the selected payment method's fields, and they are persisted to
     * the checkout session's customer_details when the payment is submitted.
     */
    setContactDetailsFields(fields: readonly ContactFieldType[] | null): void;

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
     * updated, and this never itself triggers an autosave. Complete eligible
     * addresses are verified after all saved fields have been restored.
     */
    hydrateFromSession(session: CheckoutSession): void;
    /** Apply non-empty provider defaults after server hydration without marking fields touched. */
    applyDefaultValues(values: Partial<FieldValueMap>): void;
    clearDefaultValues(): void;

    /**
     * Fetch address autocomplete suggestions for free-text input. Returns an
     * empty array on failure (including abort) so callers don't need to
     * distinguish "no results" from "errored".
     */
    autocompleteAddress(
        input: string,
        country: string | undefined,
        signal: AbortSignal,
    ): Promise<AddressAutocompleteSuggestion[]>;
    getAddressVerification(scope: AddressScope): AddressVerificationState;
    verifyAddress(scope: AddressScope): Promise<AddressValidationResult | null>;

    // Submission
    getRequiredFrameFields(): readonly FrameFieldType[];
    getRequiredValueFields(): ValueFieldType[];
    isDetailsSaveReady(): boolean;
    retryDetailsSave(): void;
    isSubmittable(): boolean;
    attemptPayment(opts: { triggerFrameValidation(type: FrameFieldType): void }): void;
    /**
     * Hand over the current attempt's payment request when it was dispatched and no
     * response has arrived yet, so its owner can resolve it after cancelling the
     * attempt. The store no longer reports that request's outcome.
     */
    takeDispatchedPayment(): PaymentAttempt | undefined;
    /**
     * Hand over the shopper-facing failure for the current attempt when the API
     * already refused its payment and the store is still preparing the message
     * (e.g. re-reading the session after an amount error). The store no longer
     * reports that failure itself.
     */
    takeAnsweredPaymentFailure(): Promise<PaymentFailure> | undefined;

    // API config
    setApiBaseUrl(url: string | undefined): void;
};

export type BiasStoreOptions = {
    clientSecret: () => string;
    apiBaseUrl?: string;
    rememberDetails?: () => boolean;
    /** Skips address verification, autocomplete, and geolocation requests. */
    preview?: () => boolean;
    /** Called whenever any state changes. Framework wires reactivity here. */
    onChange(state: BiasStoreState): void;
    /** Called once when payment succeeds. */
    onComplete?(): void;
    /**
     * Called instead of failing when a payment request was sent but its outcome is
     * unknown: the request threw after dispatch (`payment` is undefined), or the API
     * created a payment that is still pending. The owner must resolve the attempt,
     * by re-sending its identical request with its idempotency key or by following
     * the payment; the store ends its own attempt without reporting an outcome.
     */
    /**
     * A sent payment's outcome is unknown. With `reconcile`, its idempotency key can't
     * replay it, so the outcome must be looked for on the checkout session.
     */
    onPaymentPending?(
        attempt: PaymentAttempt,
        payment?: ObservedPayment,
        reconcile?: boolean,
    ): void;
    /** Asks the owner to refetch the checkout session (e.g. after its totals changed). */
    refreshCheckoutSession?(): void;
    /** Returns the controller-owned canonical session without performing another fetch. */
    getCheckoutSession?(): CheckoutSession | undefined;
    /** Routes shopper-authorized checkout mutations through the owning Elements controller. */
    updateCheckoutSession?(
        params: Pick<
            CheckoutSessionUpdateParams,
            | "billing_details"
            | "customer_details"
            | "discounts"
            | "shipping_details"
            | "shipping_rate"
        >,
        signal?: AbortSignal,
    ): Promise<CheckoutSession>;
};

export function createBiasStore(options: BiasStoreOptions): BiasStoreMethods {
    // Plain mutable state — no reactive primitives
    let state: BiasStoreState = {
        fieldState: createInitialFieldState(),
        detailsSaveState: { status: "idle" },
        paymentSelection: { kind: "new", method: "card" },
        encryptedFields: {},
        submitLoading: false,
        submitSuccess: false,
        paymentError: null,
        collectsAddress: false,
        collectsShipping: false,
        collectsContactDetails: false,
        billingSameAsShipping: false,
        addressVerification: {
            billing: { status: "idle" },
            shipping: { status: "idle" },
        },
    };

    const fieldValidators: Partial<{
        [K in ValueFieldType]: ValueFieldValidator<K>;
    }> = {};
    let apiBaseUrl = options.apiBaseUrl;
    /** Concrete (scoped) field slots each mounted address scope requires. */
    const addressFieldsByScope: Record<AddressScope, ValueFieldType[] | null> = {
        billing: null,
        shipping: null,
    };
    /** Contact fields collected by the mounted contact details elements. */
    let contactFields: readonly ContactFieldType[] = [];
    /** Fields the user has set through the UI; geo defaults never override these. */
    const touchedFields = new Set<ValueFieldType>();
    /** Provider defaults applied only to otherwise absent fields. */
    const restoredFields = new Set<ValueFieldType>();
    const valuesBeforeRestore = new Map<ValueFieldType, FieldValueMap[ValueFieldType]>();
    const serverFields = new Set<ValueFieldType>();
    let initializedDetailsSaveScheduled = false;
    let persistedDetailsFingerprint: string | undefined;
    let geoDefaultsRequested = false;
    /** True once the user has explicitly set (or hydration has inferred) "same as shipping". */
    let billingSameAsShippingTouched = false;
    let paymentAttemptGeneration = 0;
    let paymentAttemptRequest: AbortController | undefined;
    /** The current attempt's payment request while it is dispatched but unanswered. */
    let dispatchedPayment: { generation: number; attempt: PaymentAttempt } | undefined;
    /** The current attempt's failure while its shopper-facing message is prepared. */
    let answeredFailure: { generation: number; failure: Promise<PaymentFailure> } | undefined;
    let detailsGeneration = 0;
    const addressVerificationGeneration: Record<AddressScope, number> = {
        billing: 0,
        shipping: 0,
    };
    const addressVerificationRequests: Partial<Record<AddressScope, AbortController>> = {};
    const addressVerificationPromises: Partial<
        Record<AddressScope, Promise<AddressValidationResult | null>>
    > = {};
    const addressVerificationFingerprints: Partial<Record<AddressScope, string>> = {};

    const detailsAutosaver = createAutosaver(
        async (signal, generation) => {
            if (signal.aborted || generation !== detailsGeneration) return;
            if (persistedDetailsFingerprint === detailsFingerprint()) {
                setState({ detailsSaveState: { status: "saved" } });
                return;
            }
            setState({ detailsSaveState: { status: "saving" } });
            try {
                const result = await updateCheckoutDetails(signal);
                if (signal.aborted || generation !== detailsGeneration) return;
                if (result.error || !result.session) {
                    setState({
                        detailsSaveState: {
                            status: "error",
                            error: elementsError(
                                "session_update_failed",
                                undefined,
                                result.errorType,
                            ),
                        },
                    });
                    return;
                }
                if (signal.aborted || generation !== detailsGeneration) return;
                persistedDetailsFingerprint = detailsFingerprint();
                setState({ detailsSaveState: { status: "saved" } });
            } catch {
                if (signal.aborted || generation !== detailsGeneration) return;
                setState({
                    detailsSaveState: {
                        status: "error",
                        error: elementsError("session_update_failed"),
                    },
                });
            }
        },
        { delayMs: AUTOSAVE_DELAY },
    );

    function beginDetailsEdit(type: ValueFieldType): number | undefined {
        if (state.submitLoading || state.submitSuccess) return;
        const affectsContact = contactFields.includes(type as ContactFieldType);
        const affectsShipping = addressFieldsByScope.shipping?.includes(type);
        const affectsBilling =
            (!state.billingSameAsShipping && addressFieldsByScope.billing?.includes(type)) ||
            (state.billingSameAsShipping && affectsShipping);
        if (!affectsContact && !affectsShipping && !affectsBilling) return;
        const generation = ++detailsGeneration;
        setState({ detailsSaveState: { status: "dirty" } });
        return generation;
    }

    function scheduleNewlyCollectedDetailsSave(fields: readonly ValueFieldType[]) {
        if (state.submitLoading || state.submitSuccess) return;
        const collected = fields.filter(
            (field) =>
                contactFields.includes(field as ContactFieldType) ||
                addressFieldsByScope.billing?.includes(field) ||
                addressFieldsByScope.shipping?.includes(field),
        );
        if (collected.length === 0) return;
        const hasUserValue = collected.some((field) => touchedFields.has(field));
        const hasRestoredValue = collected.some((field) => restoredFields.has(field));
        if (!hasUserValue && !hasRestoredValue) return;
        if (hasRestoredValue && initializedDetailsSaveScheduled) return;
        // Framework wrappers can populate fields before a lazy custom element registers
        // its collector. Persist those values once their collection surface is mounted.
        const generation = ++detailsGeneration;
        if (hasRestoredValue) initializedDetailsSaveScheduled = true;
        setState({ detailsSaveState: { status: "dirty" } });
        detailsAutosaver.schedule(generation);
    }

    function notify() {
        options.onChange(state);
    }

    function setState(partial: Partial<BiasStoreState>) {
        state = { ...state, ...partial };
        notify();
    }

    function patchFieldState(
        type: keyof UnifiedFieldState,
        patch: Partial<UnifiedFieldState[typeof type]>,
    ) {
        setState({
            fieldState: {
                ...state.fieldState,
                [type]: { ...state.fieldState[type], ...patch },
            },
        });
    }

    function setAddressVerification(scope: AddressScope, next: AddressVerificationState) {
        setState({
            addressVerification: {
                ...state.addressVerification,
                [scope]: next,
            },
        });
    }

    function clearAddressVerification(scope: AddressScope) {
        addressVerificationGeneration[scope]++;
        addressVerificationRequests[scope]?.abort();
        delete addressVerificationRequests[scope];
        delete addressVerificationPromises[scope];
        delete addressVerificationFingerprints[scope];
        if (state.addressVerification[scope].status !== "idle") {
            setAddressVerification(scope, { status: "idle" });
        }
    }

    function clearAddressVerificationForField(type: ValueFieldType) {
        const scope = isShippingField(type) ? "shipping" : "billing";
        const unscoped = type.replace(/^shipping/, "");
        const field = `${unscoped[0]?.toLowerCase()}${unscoped.slice(1)}`;
        if (["addressLine1", "city", "state", "postalCode", "country"].includes(field)) {
            clearAddressVerification(scope);
        }
    }

    function requiredFrameFields(): readonly FrameFieldType[] {
        const selection = state.paymentSelection;
        if (selection.kind === "saved") return [];
        if (selection.method === "card") return CARD_FRAME_FIELDS;
        if (selection.method === "us_bank_account") return BANK_FRAME_FIELDS;
        return [];
    }

    function requiredValueFields(): ValueFieldType[] {
        const selection = state.paymentSelection;
        const base =
            selection.kind === "saved"
                ? []
                : selection.method === "card"
                  ? CARD_VALUE_FIELDS
                  : selection.method === "us_bank_account"
                    ? BANK_VALUE_FIELDS
                    : [];
        // When billing is aliased to shipping, its own address fields are not required.
        const billingFields =
            selection.kind === "saved" || state.billingSameAsShipping
                ? []
                : (addressFieldsByScope.billing ?? []);
        const billingBase = state.billingSameAsShipping
            ? base.filter((f) => f !== "name" && f !== "country" && f !== "postalCode")
            : base;
        return [
            ...new Set([
                ...billingBase,
                ...billingFields,
                ...(addressFieldsByScope.shipping ?? []),
                ...contactFields,
            ]),
        ];
    }

    function failSubmit(error?: string | null) {
        setState({
            submitLoading: false,
            submitSuccess: false,
            paymentError: error ?? null,
        });
    }

    /** End an attempt whose payment was sent but whose outcome is not yet known. */
    function pendSubmit(
        attemptGeneration: number,
        attempt: PaymentAttempt,
        payment?: ObservedPayment,
        reconcile = false,
    ) {
        if (attemptGeneration !== paymentAttemptGeneration) return;
        if (!options.onPaymentPending) {
            failSubmit(PAYMENT_UNCONFIRMED_MESSAGE);
            return;
        }
        options.onPaymentPending(attempt, payment, reconcile);
        setState({ submitLoading: false, submitSuccess: false, paymentError: null });
    }

    /** Forget the current attempt's unresolved request and failure; its owner took them. */
    function releaseAttemptHandoffs() {
        dispatchedPayment = undefined;
        answeredFailure = undefined;
    }

    function getFieldValidationResult<K extends ValueFieldType>(
        type: K,
        value: FieldValueMap[K],
        opts: ValueFieldValidationOptions,
    ) {
        const country = isShippingField(type)
            ? state.fieldState.shippingCountry.value
            : state.fieldState.country.value;
        return getFieldValidation(type, value, opts, fieldValidators, country);
    }

    /**
     * Recompute validity of country-dependent fields without surfacing errors.
     * Postal code and state values are cleared when the country changes; city
     * and shipping phone are kept and silently revalidated. Scoped so a shipping
     * country change only touches the shipping fields, and vice versa.
     */
    function syncCountryScopedFields(scope: AddressScope, clearValues: boolean) {
        const nextFieldState = { ...state.fieldState };
        for (const base of ["postalCode", "state", "city"] as const) {
            const field = scopedField(base, scope);
            const current = nextFieldState[field] as ValueFieldStatus<string>;
            const value = clearValues && base !== "city" ? "" : current.value;
            const result = getFieldValidationResult(field, value, { showRequired: false });
            (nextFieldState[field] as ValueFieldStatus<string>) = {
                ...current,
                value,
                valid: result.valid,
                error: null,
            };
        }

        if (scope === "shipping") {
            const phone = nextFieldState.shippingPhone;
            const phoneResult = getFieldValidationResult("shippingPhone", phone.value, {
                showRequired: false,
            });
            nextFieldState.shippingPhone = {
                ...phone,
                valid: phoneResult.valid,
                error: null,
            };
        }

        setState({ fieldState: nextFieldState });
    }

    function onCountryChanged(scope: AddressScope, country: string) {
        syncCountryScopedFields(scope, true);
        const countryField = countryFieldForScope(scope);
        // Once the country's address metadata arrives, revalidate so fields
        // the country doesn't use stop blocking submission.
        void loadAddressMetadata(country).then(() => {
            if (state.fieldState[countryField].value === country) {
                syncCountryScopedFields(scope, false);
            }
        });
    }

    function applyFieldValue<K extends ValueFieldType>(type: K, value: FieldValueMap[K]) {
        const previous = (state.fieldState[type] as ValueFieldStatus).value;
        const next = getFieldValidationResult(type, value, {
            showRequired: false,
        });
        patchFieldState(type, { value, valid: next.valid, error: null } as any);
        if (previous !== value) {
            if (type === "country") onCountryChanged("billing", value as string);
            else if (type === "shippingCountry") onCountryChanged("shipping", value as string);
        }
    }

    function addressForVerification(scope: AddressScope) {
        const line1Field = scopedField("addressLine1", scope);
        if (!addressFieldsByScope[scope]?.includes(line1Field)) return null;
        if (scope === "billing" && state.billingSameAsShipping) return null;

        const countryField = countryFieldForScope(scope);
        const cityField = scopedField("city", scope);
        const stateField = scopedField("state", scope);
        const postalField = scopedField("postalCode", scope);
        const country = state.fieldState[countryField].value;
        const line1 = state.fieldState[line1Field].value;
        const city = state.fieldState[cityField].value;
        const region = state.fieldState[stateField].value;
        const postalCode = state.fieldState[postalField].value;
        const postalValidation = getFieldValidationResult(postalField, postalCode, {
            showRequired: true,
        });

        if (
            country !== "US" ||
            !line1.trim() ||
            !city.trim() ||
            !region.trim() ||
            !postalValidation.valid
        ) {
            return null;
        }

        return {
            line1,
            city,
            state: region,
            postal_code: postalCode,
            country: country as CountryCode,
        };
    }

    function verifyAddress(scope: AddressScope): Promise<AddressValidationResult | null> {
        if (options.preview?.()) return Promise.resolve(null);
        const address = addressForVerification(scope);
        if (!address) {
            clearAddressVerification(scope);
            return Promise.resolve(null);
        }

        const fingerprint = JSON.stringify(address);
        if (addressVerificationFingerprints[scope] === fingerprint) {
            const verification = state.addressVerification[scope];
            if (verification.status === "verified") return Promise.resolve(verification.result);
            const pending = addressVerificationPromises[scope];
            if (pending) return pending;
        }

        clearAddressVerification(scope);
        const generation = ++addressVerificationGeneration[scope];
        addressVerificationFingerprints[scope] = fingerprint;
        const controller = new AbortController();
        addressVerificationRequests[scope] = controller;
        setAddressVerification(scope, { status: "verifying" });

        const timeout = setTimeout(() => controller.abort(), ADDRESS_VERIFICATION_TIMEOUT_MS);
        const promise = (async () => {
            try {
                const response = await createSdk().checkout.address.validate(address, {
                    signal: controller.signal,
                });
                if (
                    generation !== addressVerificationGeneration[scope] ||
                    controller.signal.aborted
                ) {
                    return null;
                }
                if (!("verdict" in response)) {
                    setAddressVerification(scope, { status: "idle" });
                    return null;
                }
                setAddressVerification(scope, { status: "verified", result: response });
                return response;
            } catch {
                if (generation === addressVerificationGeneration[scope]) {
                    setAddressVerification(scope, { status: "idle" });
                }
                return null;
            } finally {
                clearTimeout(timeout);
                if (generation === addressVerificationGeneration[scope]) {
                    delete addressVerificationRequests[scope];
                    delete addressVerificationPromises[scope];
                }
            }
        })();
        addressVerificationPromises[scope] = promise;
        return promise;
    }

    function pendingAddressVerificationsForSubmission() {
        const scopes = (["billing", "shipping"] as const).filter(
            (scope) =>
                addressFieldsByScope[scope] &&
                !(scope === "billing" && state.billingSameAsShipping),
        );
        return scopes.flatMap((scope) => {
            const pending = addressVerificationPromises[scope];
            return pending ? [pending] : [];
        });
    }

    function createSdk() {
        return new Bias({ apiKey: options.clientSecret(), baseURL: apiBaseUrl });
    }

    /** Extra billing details collected by a mounted billing-scope address element. */
    function addressBillingDetails() {
        const fs = state.fieldState;
        if (state.billingSameAsShipping) {
            return {
                name: fullName(fs.shippingFirstName.value, fs.shippingLastName.value),
                address: {
                    line1: fs.shippingAddressLine1.value || null,
                    line2: fs.shippingAddressLine2.value || null,
                    city: fs.shippingCity.value || null,
                    state: fs.shippingState.value || null,
                },
            };
        }
        if (!addressFieldsByScope.billing) return null;
        return {
            name: fullName(fs.firstName.value, fs.lastName.value),
            address: {
                line1: fs.addressLine1.value || null,
                line2: fs.addressLine2.value || null,
                city: fs.city.value || null,
                state: fs.state.value || null,
            },
        };
    }

    /** The billing country/postal code slots, resolved for the "same as shipping" alias. */
    function billingCountryAndPostalCode(): { country: string; postalCode: string } {
        const fs = state.fieldState;
        return state.billingSameAsShipping
            ? { country: fs.shippingCountry.value, postalCode: fs.shippingPostalCode.value }
            : { country: fs.country.value, postalCode: fs.postalCode.value };
    }

    /**
     * The billing details to persist on the checkout session. Reflects
     * whatever billing currently resolves to — including the shipping values
     * while "same as shipping" is checked — so `hydrateFromSession` can infer
     * the checked state by comparing the saved billing and shipping details.
     */
    function billingDetailsForSave() {
        if (!addressFieldsByScope.billing && !state.billingSameAsShipping) return null;
        const { country, postalCode } = billingCountryAndPostalCode();
        const address = addressBillingDetails();
        return {
            name: address?.name ?? null,
            address: {
                line1: address?.address.line1 ?? null,
                line2: address?.address.line2 ?? null,
                city: address?.address.city ?? null,
                state: address?.address.state ?? null,
                postal_code: postalCode || null,
                country: country ? (country as CountryCode) : null,
            },
        };
    }

    /** The shipping details collected by a mounted shipping-scope address element. */
    function shippingDetails() {
        if (!addressFieldsByScope.shipping) return null;
        const fs = state.fieldState;
        return {
            name: fullName(fs.shippingFirstName.value, fs.shippingLastName.value),
            phone: fs.shippingPhone.value || null,
            address: {
                line1: fs.shippingAddressLine1.value || null,
                line2: fs.shippingAddressLine2.value || null,
                city: fs.shippingCity.value || null,
                state: fs.shippingState.value || null,
                postal_code: fs.shippingPostalCode.value || null,
                country: fs.shippingCountry.value
                    ? (fs.shippingCountry.value as CountryCode)
                    : null,
            },
        };
    }

    function checkoutDetailsPatch() {
        const shipping_details = shippingDetails();
        const billing_details = billingDetailsForSave();
        const collectsCustomerName = shipping_details !== null || billing_details !== null;
        const customerName = billing_details?.name || shipping_details?.name || null;
        const customer_details =
            contactFields.length || collectsCustomerName
                ? {
                      ...(contactFields.includes("email")
                          ? { email: state.fieldState.email.value || null }
                          : {}),
                      ...(contactFields.includes("phone")
                          ? { phone: state.fieldState.phone.value || null }
                          : {}),
                      ...(collectsCustomerName ? { name: customerName } : {}),
                  }
                : undefined;
        return {
            ...(shipping_details ? { shipping_details } : {}),
            ...(billing_details ? { billing_details } : {}),
            ...(customer_details ? { customer_details } : {}),
        };
    }

    function detailsFingerprint() {
        return JSON.stringify(checkoutDetailsPatch());
    }

    function serverDetailsFingerprint(session: CheckoutSession) {
        const emptyAddress = {
            line1: null,
            line2: null,
            city: null,
            state: null,
            postal_code: null,
            country: null,
        };
        const normalizeBillingDetails = (details: CheckoutSession["billing_details"]) => ({
            name: details?.name ?? null,
            address: { ...emptyAddress, ...details?.address },
        });
        const normalizeShippingDetails = (details: CheckoutSession["shipping_details"]) => ({
            name: details?.name ?? null,
            phone: details?.phone ?? null,
            address: { ...emptyAddress, ...details?.address },
        });
        const collectsCustomerName =
            addressFieldsByScope.shipping !== null ||
            addressFieldsByScope.billing !== null ||
            state.billingSameAsShipping;
        const customer_details =
            contactFields.length || collectsCustomerName
                ? {
                      ...(contactFields.includes("email")
                          ? { email: session.customer_details.email ?? null }
                          : {}),
                      ...(contactFields.includes("phone")
                          ? { phone: session.customer_details.phone ?? null }
                          : {}),
                      ...(collectsCustomerName
                          ? { name: session.customer_details.name ?? null }
                          : {}),
                  }
                : undefined;
        return JSON.stringify({
            ...(addressFieldsByScope.shipping
                ? { shipping_details: normalizeShippingDetails(session.shipping_details) }
                : {}),
            ...(addressFieldsByScope.billing || state.billingSameAsShipping
                ? { billing_details: normalizeBillingDetails(session.billing_details) }
                : {}),
            ...(customer_details ? { customer_details } : {}),
        });
    }

    async function updateCheckoutDetails(signal?: AbortSignal) {
        const patch = checkoutDetailsPatch();
        if (Object.keys(patch).length === 0) {
            const canonical = options.getCheckoutSession?.();
            if (canonical) return { error: null, session: canonical };
            const session = await createSdk().checkoutSessions.get("current", undefined, {
                signal,
            });
            return session.object === "error"
                ? {
                      error: session.error.message,
                      errorType: session.error.type,
                      customerMessage: session.error.customer_message,
                      session: null,
                  }
                : { error: null, session };
        }
        if (options.updateCheckoutSession) {
            try {
                const session = await options.updateCheckoutSession(patch, signal);
                return { error: null, session };
            } catch (error) {
                return {
                    error:
                        error instanceof Error
                            ? error.message
                            : "The checkout details could not be saved.",
                    errorType: (error as Partial<BiasElementsError> | null)?.apiErrorType,
                    customerMessage: (error as Partial<BiasElementsError> | null)?.customerMessage,
                    session: null,
                };
            }
        }
        const result = await createSdk().checkoutSessions.update("current", patch, { signal });
        return result.object === "error"
            ? {
                  error: result.error.message,
                  errorType: result.error.type,
                  customerMessage: result.error.customer_message,
                  session: null,
              }
            : { error: null, session: result };
    }

    async function createPayment(
        attemptGeneration: number,
        signal: AbortSignal,
        shown: CheckoutSession | undefined,
    ) {
        const stale = () => signal.aborted || attemptGeneration !== paymentAttemptGeneration;
        const fail = (error?: string | null) => {
            if (attemptGeneration === paymentAttemptGeneration) failSubmit(error);
        };
        const failDetails = (details: Awaited<ReturnType<typeof updateCheckoutDetails>>) =>
            fail(
                details.error &&
                    shopperErrorMessage({
                        customer_message:
                            "customerMessage" in details ? details.customerMessage : null,
                    }),
            );
        const failMissing = (what: string) => {
            console.error(`Bias Elements: Missing ${what}.`);
            fail(PAYMENT_NOT_COMPLETED_MESSAGE);
        };
        /** Saving details can return a session whose terms the customer hasn't seen yet. */
        const termsChanged = (session: CheckoutSession) => {
            const changed = subscriptionTerms(session) !== subscriptionTerms(shown);
            if (changed) fail(SUBSCRIPTION_TERMS_CHANGED_MESSAGE);
            return changed;
        };
        const complete = () => {
            if (attemptGeneration !== paymentAttemptGeneration) return;
            setState({ submitLoading: false, submitSuccess: true, paymentError: null });
            if (attemptGeneration === paymentAttemptGeneration) options.onComplete?.();
        };
        const { fieldState, encryptedFields, paymentSelection } = state;
        const remember = options.rememberDetails?.() ?? false;
        const paymentMethodType =
            paymentSelection.kind === "saved"
                ? paymentSelection.method.type
                : paymentSelection.method;
        // What the shopper saw at submit, before address verification and the details
        // save, $0 included: the session's server-computed amount remaining for the method.
        const displayedAmount = shown
            ? checkoutAmountRemaining(shown, paymentMethodType)
            : undefined;
        /**
         * Pin the charge to the displayed amount. Returns null when the details save
         * changed it (from or to $0 too), so the shopper reviews the new amount first,
         * or when there is nothing to charge. Setup sessions charge nothing to pin; a
         * free first subscription period pins $0.
         */
        const amountParams = (session: CheckoutSession) => {
            if (session.mode === "setup") return {};
            const amount = checkoutAmountRemaining(session, paymentMethodType);
            if (displayedAmount !== undefined && amount !== displayedAmount) return null;
            if (amount <= 0 && !subscriptionFreeToday(session)) return null;
            return { amount, checkout_session_updated_at: session.updated_at };
        };
        const failTotalsChanged = () => {
            if (attemptGeneration !== paymentAttemptGeneration) return;
            failSubmit(CHECKOUT_TOTALS_CHANGED_MESSAGE);
            options.refreshCheckoutSession?.();
        };
        const failPayment = async (error: ApiError["error"], attempt: PaymentAttempt) => {
            if (error.code === "checkout_totals_changed" && error.param === "subscription_terms") {
                fail(SUBSCRIPTION_TERMS_CHANGED_MESSAGE);
                options.refreshCheckoutSession?.();
                return;
            }
            // The API answered, so this request created no payment. Preparing the message
            // is not tied to the attempt's signal: if the attempt is cancelled meanwhile
            // (a frame change), its owner takes the failure over instead.
            const failure = describePaymentError(error, attempt.sentAmount, async () => {
                const current = await createSdk().checkoutSessions.get("current");
                return current.object === "error"
                    ? undefined
                    : checkoutAmountRemaining(current, paymentMethodType);
            });
            const handoff = { generation: attemptGeneration, failure };
            answeredFailure = handoff;
            const resolved = await failure;
            if (answeredFailure !== handoff || stale()) return;
            answeredFailure = undefined;
            if (resolved.totalsChanged) failTotalsChanged();
            else fail(resolved.message);
        };
        /**
         * Send the attempt's one payment request. Its body and idempotency key are kept
         * so an ambiguous outcome can be resolved by re-sending the identical request.
         */
        const sendPayment = async (params: PaymentCreateParams) => {
            const attempt: PaymentAttempt = {
                method: paymentMethodType,
                idempotencyKey: createIdempotencyKey(),
                params,
                sentAmount: params.amount,
                knownPaymentIds: sessionPaymentIds(options.getCheckoutSession?.()),
            };
            const handoff = { generation: attemptGeneration, attempt };
            dispatchedPayment = handoff;
            let payment: Awaited<ReturnType<Bias["payments"]["create"]>>;
            try {
                payment = await createSdk().payments.create(attempt.params, {
                    signal,
                    idempotencyKey: attempt.idempotencyKey,
                });
            } catch {
                if (dispatchedPayment !== handoff || stale()) return;
                dispatchedPayment = undefined;
                // A request that threw after dispatch (timeout, network error, non-JSON
                // gateway response) may still have charged the shopper.
                pendSubmit(attemptGeneration, attempt);
                return;
            }
            if (dispatchedPayment !== handoff || stale()) return;
            dispatchedPayment = undefined;
            if (payment.object === "error") {
                switch (classifyIdempotencyError(payment.error)) {
                    // Another request still holds the key, or the request was throttled:
                    // neither says whether a payment exists yet.
                    case "retry":
                        pendSubmit(attemptGeneration, attempt);
                        return;
                    case "reconcile":
                        pendSubmit(attemptGeneration, attempt, undefined, true);
                        return;
                    case "mismatch":
                        fail(PAYMENT_UNCONFIRMED_MESSAGE);
                        return;
                    case "answered":
                        await failPayment(payment.error, attempt);
                        return;
                }
            }
            const outcome = classifyPaymentStatus(payment.status, paymentMethodType);
            if (outcome === "succeeded") complete();
            else if (outcome === "failed") fail(failedPaymentMessage(payment));
            else pendSubmit(attemptGeneration, attempt, payment);
        };

        if (paymentSelection.kind === "saved") {
            const details = await updateCheckoutDetails(signal);
            if (stale()) return;
            if (details.error || !details.session) {
                failDetails(details);
                return;
            }
            if (termsChanged(details.session)) return;
            const amount = amountParams(details.session);
            if (!amount) {
                failTotalsChanged();
                return;
            }
            await sendPayment({
                ...amount,
                payment_method: paymentSelection.method.id,
                remember,
            });
        } else if (paymentSelection.method === "card") {
            const {
                cardNumber: encryptedNumber,
                cardExpiry: encryptedExpiry,
                cardCvc: encryptedCvc,
            } = encryptedFields;
            const { country, postalCode } = billingCountryAndPostalCode();

            if (!encryptedNumber || !encryptedExpiry || !encryptedCvc) {
                failMissing("payment method details");
                return;
            }
            if (!country) {
                failMissing("billing country");
                return;
            }
            if (!postalCode && resolveAddressMetadata(country).postalCode.used) {
                failMissing("billing postal code");
                return;
            }

            const details = await updateCheckoutDetails(signal);
            if (stale()) return;
            if (details.error || !details.session) {
                failDetails(details);
                return;
            }
            const session = details.session;
            if (termsChanged(session)) return;
            const amount = amountParams(session);
            if (!amount) {
                failTotalsChanged();
                return;
            }

            const address = addressBillingDetails();
            await sendPayment({
                ...amount,
                remember,
                payment_method: {
                    card: {
                        encrypted_number: encryptedNumber,
                        encrypted_expiry: encryptedExpiry,
                        encrypted_cvc: encryptedCvc,
                    },
                    billing_details: {
                        name: address?.name,
                        address: {
                            ...address?.address,
                            country: country as CountryCode,
                            postal_code: postalCode || undefined,
                        },
                    },
                    setup_future_usage: session.mode === "setup" ? "off_session" : undefined,
                },
            });
        } else if (paymentSelection.method === "us_bank_account") {
            const { accountType, accountHolderType } = fieldState;
            const { country, postalCode } = billingCountryAndPostalCode();
            const {
                bankAccountNumber: encryptedAccountNumber,
                bankRoutingNumber: encryptedRoutingNumber,
            } = encryptedFields;

            if (!encryptedAccountNumber || !encryptedRoutingNumber) {
                failMissing("bank account details");
                return;
            }

            const details = await updateCheckoutDetails(signal);
            if (stale()) return;
            if (details.error || !details.session) {
                failDetails(details);
                return;
            }
            const session = details.session;
            if (termsChanged(session)) return;
            const amount = amountParams(session);
            if (!amount) {
                failTotalsChanged();
                return;
            }

            const address = addressBillingDetails();
            await sendPayment({
                ...amount,
                remember,
                payment_method: {
                    us_bank_account: {
                        encrypted_routing_number: encryptedRoutingNumber,
                        encrypted_account_number: encryptedAccountNumber,
                        account_type: accountType.value,
                        account_holder_type: accountHolderType.value,
                    },
                    billing_details: {
                        name: address?.name ?? undefined,
                        address: {
                            ...address?.address,
                            country: country ? (country as CountryCode) : undefined,
                            postal_code: postalCode || undefined,
                        },
                    },
                    setup_future_usage: session.mode === "setup" ? "off_session" : undefined,
                },
                ...bankAccountMandate(shown, accountHolderType.value),
            });
        }
    }

    return {
        getState: () => state,

        cancel() {
            paymentAttemptGeneration++;
            releaseAttemptHandoffs();
            detailsGeneration++;
            paymentAttemptRequest?.abort();
            paymentAttemptRequest = undefined;
            void detailsAutosaver.cancel();
            clearAddressVerification("billing");
            clearAddressVerification("shipping");
            setState({ detailsSaveState: { status: "idle" } });
        },

        setFrameFieldState(type, nextState) {
            patchFieldState(type, nextState as Partial<BiasFieldStatus>);
        },

        onEncryptedData(field, encryptedValue) {
            setState({
                encryptedFields: { ...state.encryptedFields, [field]: encryptedValue },
                fieldState: {
                    ...state.fieldState,
                    [field]: { ...state.fieldState[field], valid: !!encryptedValue },
                },
            });
        },

        resetFrameFields() {
            paymentAttemptGeneration++;
            releaseAttemptHandoffs();
            paymentAttemptRequest?.abort();
            paymentAttemptRequest = undefined;
            const nextFieldState = { ...state.fieldState };
            for (const type of ALL_FRAME_FIELDS) {
                nextFieldState[type] = initialFrameField();
            }

            setState({
                encryptedFields: {},
                fieldState: nextFieldState,
                submitLoading: false,
                submitSuccess: false,
                paymentError: null,
            });
        },

        resetSessionFields() {
            paymentAttemptGeneration++;
            releaseAttemptHandoffs();
            detailsGeneration++;
            void detailsAutosaver.cancel();
            paymentAttemptRequest?.abort();
            paymentAttemptRequest = undefined;
            clearAddressVerification("billing");
            clearAddressVerification("shipping");
            touchedFields.clear();
            restoredFields.clear();
            valuesBeforeRestore.clear();
            serverFields.clear();
            initializedDetailsSaveScheduled = false;
            geoDefaultsRequested = false;
            persistedDetailsFingerprint = undefined;
            billingSameAsShippingTouched = false;
            setState({
                fieldState: createInitialFieldState(),
                detailsSaveState: { status: "idle" },
                paymentSelection: { kind: "new", method: "card" },
                encryptedFields: {},
                submitLoading: false,
                submitSuccess: false,
                paymentError: null,
                billingSameAsShipping: false,
                addressVerification: {
                    billing: { status: "idle" },
                    shipping: { status: "idle" },
                },
            });
        },

        setFieldValue(type, value) {
            if (state.submitLoading || state.submitSuccess) return;
            const previous = (state.fieldState[type] as ValueFieldStatus).value;
            if (previous !== value) clearAddressVerificationForField(type);
            const saveGeneration = beginDetailsEdit(type);
            touchedFields.add(type);
            applyFieldValue(type, value);
            if (saveGeneration !== undefined) detailsAutosaver.schedule(saveGeneration);
        },

        validateField(type) {
            const current = state.fieldState[type] as ValueFieldStatus;
            const next = getFieldValidationResult(
                type,
                current.value as FieldValueMap[typeof type],
                { showRequired: touchedFields.has(type) || current.error != null },
            );
            patchFieldState(type, {
                value: current.value,
                valid: next.valid,
                error: next.error,
            } as any);
        },

        setValueFieldState(type, nextState) {
            patchFieldState(type, nextState as any);
        },

        registerFieldValidator(type, validator) {
            (fieldValidators as any)[type] = validator;
        },

        unregisterFieldValidator(type) {
            delete fieldValidators[type];
        },

        setSelectedPaymentMethod(method) {
            // Clear all field errors when switching methods
            const clearedFields = Object.fromEntries(
                Object.entries(state.fieldState).map(([key, val]) => [
                    key,
                    { ...val, error: null },
                ]),
            ) as UnifiedFieldState;

            setState({
                paymentSelection: { kind: "new", method },
                paymentError: null,
                fieldState: clearedFields,
            });
        },

        setSelectedSavedPaymentMethod(method) {
            const clearedFields = Object.fromEntries(
                Object.entries(state.fieldState).map(([key, value]) => [
                    key,
                    { ...value, error: null },
                ]),
            ) as UnifiedFieldState;
            setState({
                paymentSelection: { kind: "saved", method },
                paymentError: null,
                fieldState: clearedFields,
            });
        },

        setAddressFields(scope, fields) {
            const previousFields = addressFieldsByScope[scope];
            const nextFields = fields === null ? null : fields.map((f) => scopedField(f, scope));
            if (
                previousFields === nextFields ||
                (previousFields !== null &&
                    nextFields !== null &&
                    previousFields.length === nextFields.length &&
                    previousFields.every((field, index) => field === nextFields[index]))
            ) {
                return;
            }
            addressFieldsByScope[scope] = nextFields;
            if (scope === "shipping") setState({ collectsShipping: fields !== null });
            else setState({ collectsAddress: fields?.includes("addressLine1") ?? false });
            if (nextFields === null) clearAddressVerification(scope);
            else {
                const nextFieldState = { ...state.fieldState };
                for (const field of nextFields.filter(
                    (field) => !previousFields?.includes(field),
                )) {
                    const current = state.fieldState[field] as ValueFieldStatus;
                    const validation = getFieldValidationResult(
                        field,
                        current.value as FieldValueMap[typeof field],
                        { showRequired: true },
                    );
                    nextFieldState[field] = {
                        ...current,
                        valid: validation.valid,
                        error: null,
                    } as any;
                }
                setState({ fieldState: nextFieldState });
                scheduleNewlyCollectedDetailsSave(
                    nextFields.filter((field) => !previousFields?.includes(field)),
                );
            }
        },

        setContactDetailsFields(fields) {
            const previousFields = contactFields;
            const nextFields = fields ?? [];
            if (
                previousFields.length === nextFields.length &&
                previousFields.every((field) => nextFields.includes(field))
            )
                return;
            contactFields = nextFields;
            setState({ collectsContactDetails: nextFields.length > 0 });
            scheduleNewlyCollectedDetailsSave(
                nextFields.filter((field) => !previousFields.includes(field)),
            );
        },

        setBillingSameAsShipping(value) {
            if (state.submitLoading || state.submitSuccess) return;
            billingSameAsShippingTouched = true;
            if (state.billingSameAsShipping === value) return;
            const generation = ++detailsGeneration;
            setState({ detailsSaveState: { status: "dirty" } });
            setState({ billingSameAsShipping: value });
            clearAddressVerification("billing");
            detailsAutosaver.schedule(generation);
        },

        async applyGeoDefaults() {
            if (geoDefaultsRequested || options.preview?.()) return;
            geoDefaultsRequested = true;

            const geo = await detectGeoLocation();
            const country = geo?.country;
            if (!country || !(country in COUNTRY_NAMES)) return;

            const metadata = await loadAddressMetadata(country);
            const region = geo.region?.trim().toLowerCase();
            const match = region
                ? metadata.state.options.find(
                      (option) =>
                          option.name.toLowerCase() === region ||
                          option.key.toLowerCase() === region,
                  )
                : undefined;

            for (const scope of ["billing", "shipping"] as const) {
                const countryField = countryFieldForScope(scope);
                const stateField = scopedField("state", scope);
                if (
                    touchedFields.has(countryField) ||
                    restoredFields.has(countryField) ||
                    serverFields.has(countryField)
                )
                    continue;
                if (state.fieldState[countryField].value !== country) {
                    applyFieldValue(countryField, country);
                }
                if (
                    match &&
                    !touchedFields.has(stateField) &&
                    !restoredFields.has(stateField) &&
                    !serverFields.has(stateField) &&
                    !state.fieldState[stateField].value &&
                    state.fieldState[countryField].value === country
                ) {
                    applyFieldValue(stateField, match.key);
                }
            }
        },

        hydrateFromSession(session) {
            persistedDetailsFingerprint = serverDetailsFingerprint(session);
            for (const field of contactFields) {
                const value = session.customer_details[field];
                if (!value || touchedFields.has(field)) continue;
                restoredFields.delete(field);
                valuesBeforeRestore.delete(field);
                serverFields.add(field);
                applyFieldValue(field, value);
            }

            const shipping = session.shipping_details;
            if (addressFieldsByScope.shipping && shipping) {
                if (shipping.address.country && !touchedFields.has("shippingCountry")) {
                    restoredFields.delete("shippingCountry");
                    valuesBeforeRestore.delete("shippingCountry");
                    serverFields.add("shippingCountry");
                    applyFieldValue("shippingCountry", shipping.address.country);
                }
                const shippingName = shipping.name ? splitFullName(shipping.name) : undefined;
                const values: Partial<Record<ValueFieldType, string>> = {
                    shippingFirstName: shippingName?.firstName,
                    shippingLastName: shippingName?.lastName,
                    shippingPhone: shipping.phone ?? undefined,
                    shippingAddressLine1: shipping.address.line1 ?? undefined,
                    shippingAddressLine2: shipping.address.line2 ?? undefined,
                    shippingCity: shipping.address.city ?? undefined,
                    shippingState: shipping.address.state ?? undefined,
                    shippingPostalCode: shipping.address.postal_code ?? undefined,
                };
                for (const [type, value] of Object.entries(values) as [
                    ValueFieldType,
                    string | undefined,
                ][]) {
                    if (value && !touchedFields.has(type)) {
                        restoredFields.delete(type);
                        valuesBeforeRestore.delete(type);
                        serverFields.add(type);
                        applyFieldValue(type, value);
                    }
                }
            }

            const billing = session.billing_details;
            if (addressFieldsByScope.billing && billing) {
                if (billing.address.country && !touchedFields.has("country")) {
                    restoredFields.delete("country");
                    valuesBeforeRestore.delete("country");
                    serverFields.add("country");
                    applyFieldValue("country", billing.address.country);
                }
                const billingName = billing.name ? splitFullName(billing.name) : undefined;
                const values: Partial<Record<ValueFieldType, string>> = {
                    firstName: billingName?.firstName,
                    lastName: billingName?.lastName,
                    addressLine1: billing.address.line1 ?? undefined,
                    addressLine2: billing.address.line2 ?? undefined,
                    city: billing.address.city ?? undefined,
                    state: billing.address.state ?? undefined,
                    postalCode: billing.address.postal_code ?? undefined,
                };
                for (const [type, value] of Object.entries(values) as [
                    ValueFieldType,
                    string | undefined,
                ][]) {
                    if (value && !touchedFields.has(type)) {
                        restoredFields.delete(type);
                        valuesBeforeRestore.delete(type);
                        serverFields.add(type);
                        applyFieldValue(type, value);
                    }
                }
            }

            // Infer the "same as shipping" checkbox state by comparing the
            // saved billing and shipping addresses, rather than persisting a
            // separate flag — the two scopes are considered equal once name
            // and every address field match.
            if (
                !billingSameAsShippingTouched &&
                billing &&
                shipping &&
                billing.name === shipping.name &&
                billing.address.line1 === shipping.address.line1 &&
                billing.address.line2 === shipping.address.line2 &&
                billing.address.city === shipping.address.city &&
                billing.address.state === shipping.address.state &&
                billing.address.postal_code === shipping.address.postal_code &&
                billing.address.country === shipping.address.country
            ) {
                billingSameAsShippingTouched = true;
                setState({ billingSameAsShipping: true });
            }

            // Verify only after the complete saved address has been restored and
            // same-as-shipping has been inferred. The verifier handles local
            // eligibility, request deduplication, and billing-scope suppression.
            if (shipping) void verifyAddress("shipping");
            if (billing) void verifyAddress("billing");
        },

        applyDefaultValues(values) {
            const newlyRestored: ValueFieldType[] = [];
            for (const [type, value] of Object.entries(values) as [
                ValueFieldType,
                FieldValueMap[ValueFieldType] | undefined,
            ][]) {
                if (typeof value !== "string" || value.trim() === "") continue;
                if (touchedFields.has(type) || serverFields.has(type) || restoredFields.has(type))
                    continue;
                const current = state.fieldState[type] as ValueFieldStatus;
                const isCountryFallback =
                    (type === "country" || type === "shippingCountry") && current.value === "US";
                if (current.value && !isCountryFallback) continue;
                valuesBeforeRestore.set(type, current.value as FieldValueMap[ValueFieldType]);
                restoredFields.add(type);
                newlyRestored.push(type);
                applyFieldValue(type, value as never);
            }
            if (
                persistedDetailsFingerprint !== undefined &&
                detailsFingerprint() !== persistedDetailsFingerprint
            ) {
                scheduleNewlyCollectedDetailsSave(newlyRestored);
            }
        },

        clearDefaultValues() {
            for (const type of restoredFields) {
                if (touchedFields.has(type) || serverFields.has(type)) continue;
                const previous = valuesBeforeRestore.get(type);
                if (previous !== undefined) applyFieldValue(type, previous as never);
            }
            restoredFields.clear();
            valuesBeforeRestore.clear();
            initializedDetailsSaveScheduled = false;
            geoDefaultsRequested = false;
        },

        async autocompleteAddress(input, country, signal) {
            if (options.preview?.()) return [];
            try {
                const result = await createSdk().checkout.address.autocomplete(
                    { input, country: country as CountryCode | undefined },
                    { signal },
                );
                return Array.isArray(result) ? result : [];
            } catch {
                return [];
            }
        },

        getAddressVerification(scope) {
            return state.addressVerification[scope];
        },

        verifyAddress,

        getRequiredFrameFields() {
            return requiredFrameFields();
        },

        getRequiredValueFields() {
            return requiredValueFields();
        },

        isDetailsSaveReady() {
            return (
                state.detailsSaveState.status === "idle" ||
                state.detailsSaveState.status === "saved"
            );
        },

        retryDetailsSave() {
            if (
                state.submitLoading ||
                state.submitSuccess ||
                state.detailsSaveState.status !== "error"
            )
                return;
            setState({ detailsSaveState: { status: "dirty" } });
            detailsAutosaver.retry(detailsGeneration);
        },

        isSubmittable() {
            return (
                requiredFrameFields().every((f) => !!state.encryptedFields[f]) &&
                requiredValueFields().every((f) => state.fieldState[f].valid)
            );
        },

        attemptPayment({ triggerFrameValidation }) {
            if (state.submitLoading || state.submitSuccess) return;

            // Enter the loading state in the same update that cancels a pending
            // details save, so observers never see a non-loading intermediate state.
            const cancelDirtyDetailsSave = state.detailsSaveState.status === "dirty";
            if (cancelDirtyDetailsSave) {
                detailsGeneration++;
                void detailsAutosaver.cancel();
            }

            setState({
                paymentError: null,
                submitLoading: true,
                submitSuccess: false,
                ...(cancelDirtyDetailsSave
                    ? { detailsSaveState: { status: "idle" as const } }
                    : {}),
            });

            const frameFields = requiredFrameFields();
            const valueFields = requiredValueFields();

            for (const field of frameFields) {
                triggerFrameValidation(field);
            }

            // Validate value fields, writing errors into state
            let allValueFieldsValid = true;
            const nextFieldState = { ...state.fieldState };

            for (const field of valueFields) {
                const current = state.fieldState[field] as ValueFieldStatus;
                const result = getFieldValidationResult(
                    field,
                    current.value as FieldValueMap[typeof field],
                    { showRequired: true },
                );
                nextFieldState[field] = {
                    ...current,
                    valid: result.valid,
                    error: result.error,
                } as any;
                if (!result.valid) allValueFieldsValid = false;
            }

            setState({ fieldState: nextFieldState });

            const detailsSaveReady =
                state.detailsSaveState.status === "idle" ||
                state.detailsSaveState.status === "saved";
            if (
                detailsSaveReady &&
                frameFields.every((f) => !!state.encryptedFields[f]) &&
                allValueFieldsValid
            ) {
                const attemptGeneration = ++paymentAttemptGeneration;
                const shown = options.getCheckoutSession?.();
                paymentAttemptRequest?.abort();
                const request = new AbortController();
                paymentAttemptRequest = request;
                void Promise.resolve().then(async () => {
                    if (attemptGeneration !== paymentAttemptGeneration || request.signal.aborted)
                        return;
                    const pendingVerifications = pendingAddressVerificationsForSubmission();
                    if (pendingVerifications.length > 0) {
                        await Promise.allSettled(pendingVerifications);
                    }
                    if (attemptGeneration !== paymentAttemptGeneration || request.signal.aborted)
                        return;
                    // Failures after the payment request was dispatched are handled where it
                    // is sent; anything thrown here happened before any payment existed.
                    void createPayment(attemptGeneration, request.signal, shown).catch(() => {
                        if (
                            attemptGeneration !== paymentAttemptGeneration ||
                            request.signal.aborted
                        )
                            return;
                        failSubmit(PAYMENT_NOT_COMPLETED_MESSAGE);
                    });
                });
                return;
            }

            failSubmit();
        },

        takeDispatchedPayment() {
            const handoff = dispatchedPayment;
            if (!handoff || handoff.generation !== paymentAttemptGeneration || !state.submitLoading)
                return undefined;
            dispatchedPayment = undefined;
            return handoff.attempt;
        },

        takeAnsweredPaymentFailure() {
            const handoff = answeredFailure;
            if (!handoff || handoff.generation !== paymentAttemptGeneration || !state.submitLoading)
                return undefined;
            answeredFailure = undefined;
            return handoff.failure;
        },

        setApiBaseUrl(url) {
            apiBaseUrl = url;
        },
    };
}
