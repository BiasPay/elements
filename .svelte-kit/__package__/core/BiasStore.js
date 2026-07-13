import { Bias, } from "@biaspay/sdk";
import { COUNTRY_NAMES, loadAddressMetadata, resolveAddressMetadata } from "./address-metadata";
import { createAutosaver } from "./autosave";
import { detectGeoLocation } from "./geo";
import { scopedField } from "./types";
import { getFieldValidation } from "./validation";
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const CARD_FRAME_FIELDS = [
    "cardNumber",
    "cardExpiry",
    "cardCvc",
];
export const CARD_VALUE_FIELDS = [
    "country",
    "postalCode",
];
export const BANK_FRAME_FIELDS = [
    "bankAccountNumber",
    "bankRoutingNumber",
];
export const ALL_FRAME_FIELDS = [
    ...CARD_FRAME_FIELDS,
    ...BANK_FRAME_FIELDS,
];
export const BANK_VALUE_FIELDS = [
    "name",
    "accountType",
    "country",
    "postalCode",
];
/** Fields the address element always requires; it appends "phone" when collecting one. */
export const ADDRESS_VALUE_FIELDS = [
    "name",
    "country",
    "addressLine1",
    "city",
    "state",
    "postalCode",
];
const SUBMIT_DELAY = 200;
const AUTOSAVE_DELAY = 1000;
// ---------------------------------------------------------------------------
// Initial state factories
// ---------------------------------------------------------------------------
export function initialFrameField() {
    return {
        loading: true,
        focused: false,
        empty: true,
        valid: false,
        error: null,
        cardBrand: null,
    };
}
export function initialValueField(value = "", valid = false) {
    return { value: value, focused: false, valid, error: null };
}
export function createInitialFieldState() {
    return {
        cardNumber: initialFrameField(),
        cardExpiry: initialFrameField(),
        cardCvc: initialFrameField(),
        bankAccountNumber: initialFrameField(),
        bankRoutingNumber: initialFrameField(),
        country: initialValueField("US", true),
        postalCode: initialValueField(),
        accountType: initialValueField("checking", true),
        email: initialValueField(),
        name: initialValueField(),
        addressLine1: initialValueField(),
        // Optional fields start valid so an untouched form can still submit
        addressLine2: initialValueField("", true),
        city: initialValueField(),
        state: initialValueField(),
        phone: initialValueField("", true),
        shippingCountry: initialValueField("US", true),
        shippingPostalCode: initialValueField(),
        shippingName: initialValueField(),
        shippingAddressLine1: initialValueField(),
        shippingAddressLine2: initialValueField("", true),
        shippingCity: initialValueField(),
        shippingState: initialValueField(),
        shippingPhone: initialValueField("", true),
    };
}
/** Country field slot for a scope; used to resolve country-scoped validation. */
function countryFieldForScope(scope) {
    return scope === "shipping" ? "shippingCountry" : "country";
}
/** Whether a field belongs to the shipping scope. */
function isShippingField(type) {
    return typeof type === "string" && type.startsWith("shipping");
}
export function createBiasStore(options) {
    // Plain mutable state — no reactive primitives
    let state = {
        fieldState: createInitialFieldState(),
        selectedPaymentMethod: "card",
        encryptedFields: {},
        submitLoading: false,
        submitSuccess: false,
        paymentError: null,
        collectsAddress: false,
        collectsShipping: false,
        collectsContactDetails: false,
        billingSameAsShipping: false,
    };
    const fieldValidators = {};
    let apiBaseUrl = options.apiBaseUrl;
    /** Concrete (scoped) field slots each mounted address scope requires. */
    const addressFieldsByScope = {
        billing: null,
        shipping: null,
    };
    /** Whether a contact details (email) element is currently mounted. */
    let collectsContactDetails = false;
    /** Fields the user has set through the UI; geo defaults never override these. */
    const touchedFields = new Set();
    let geoDefaultsRequested = false;
    /** True once the user has explicitly set (or hydration has inferred) "same as shipping". */
    let billingSameAsShippingTouched = false;
    let paymentAttemptGeneration = 0;
    let completionTimer;
    let paymentAttemptRequest;
    const contactAutosaver = createAutosaver((signal) => updateCustomerDetails(createSdk(), signal).catch(() => undefined), { delayMs: AUTOSAVE_DELAY });
    const shippingAutosaver = createAutosaver((signal) => updateShipping(createSdk(), signal).catch(() => undefined), { delayMs: AUTOSAVE_DELAY });
    const billingAutosaver = createAutosaver((signal) => updateBilling(createSdk(), signal).catch(() => undefined), { delayMs: AUTOSAVE_DELAY });
    function scheduleAutosave(type) {
        if (state.submitLoading || state.submitSuccess)
            return;
        if (collectsContactDetails && type === "email")
            contactAutosaver.schedule();
        if (addressFieldsByScope.shipping?.includes(type))
            shippingAutosaver.schedule();
        if (!state.billingSameAsShipping && addressFieldsByScope.billing?.includes(type)) {
            billingAutosaver.schedule();
        }
        // While aliased to shipping, a shipping edit also changes what billing resolves to.
        if (state.billingSameAsShipping && addressFieldsByScope.shipping?.includes(type)) {
            billingAutosaver.schedule();
        }
    }
    function notify() {
        options.onChange(state);
    }
    function setState(partial) {
        state = { ...state, ...partial };
        notify();
    }
    function patchFieldState(type, patch) {
        setState({
            fieldState: {
                ...state.fieldState,
                [type]: { ...state.fieldState[type], ...patch },
            },
        });
    }
    function requiredFrameFields() {
        if (state.selectedPaymentMethod === "card")
            return CARD_FRAME_FIELDS;
        if (state.selectedPaymentMethod === "us_bank_account")
            return BANK_FRAME_FIELDS;
        return [];
    }
    function requiredValueFields() {
        const base = state.selectedPaymentMethod === "card"
            ? CARD_VALUE_FIELDS
            : state.selectedPaymentMethod === "us_bank_account"
                ? BANK_VALUE_FIELDS
                : [];
        // When billing is aliased to shipping, billing's own country/postal
        // code (and any billing-scope address element's fields) aren't
        // required — shipping's equivalents already are.
        const billingFields = state.billingSameAsShipping
            ? (addressFieldsByScope.billing ?? []).filter((f) => f !== "country" && f !== "postalCode")
            : (addressFieldsByScope.billing ?? []);
        const billingBase = state.billingSameAsShipping
            ? base.filter((f) => f !== "country" && f !== "postalCode")
            : base;
        return [
            ...new Set([
                ...billingBase,
                ...billingFields,
                ...(addressFieldsByScope.shipping ?? []),
                ...(collectsContactDetails ? ["email"] : []),
            ]),
        ];
    }
    function failSubmit(error) {
        setState({
            submitLoading: false,
            submitSuccess: false,
            paymentError: error ?? null,
        });
    }
    function getFieldValidationResult(type, value, opts) {
        const country = isShippingField(type)
            ? state.fieldState.shippingCountry.value
            : state.fieldState.country.value;
        return getFieldValidation(type, value, opts, fieldValidators, country);
    }
    /**
     * Recompute validity of the country-scoped fields (postal code, state,
     * city) without surfacing errors. Postal code and state values are
     * country-specific, so they are cleared when the country changes; city is
     * kept and revalidated (it may stop being required). Scoped so a shipping
     * country change only touches the shipping fields, and vice versa.
     */
    function syncCountryScopedFields(scope, clearValues) {
        const nextFieldState = { ...state.fieldState };
        for (const base of ["postalCode", "state", "city"]) {
            const field = scopedField(base, scope);
            const current = nextFieldState[field];
            const value = clearValues && base !== "city" ? "" : current.value;
            const result = getFieldValidationResult(field, value, { showRequired: false });
            nextFieldState[field] = {
                ...current,
                value,
                valid: result.valid,
                error: null,
            };
        }
        setState({ fieldState: nextFieldState });
    }
    function onCountryChanged(scope, country) {
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
    function applyFieldValue(type, value) {
        const previous = state.fieldState[type].value;
        const next = getFieldValidationResult(type, value, {
            showRequired: false,
        });
        patchFieldState(type, { value, valid: next.valid, error: null });
        if (previous !== value) {
            if (type === "country")
                onCountryChanged("billing", value);
            else if (type === "shippingCountry")
                onCountryChanged("shipping", value);
        }
    }
    function createSdk() {
        return new Bias({ apiKey: options.clientSecret(), baseURL: apiBaseUrl });
    }
    /** Extra billing details collected by a mounted billing-scope address element. */
    function addressBillingDetails() {
        if (state.billingSameAsShipping) {
            const fs = state.fieldState;
            return {
                name: fs.shippingName.value || null,
                address: {
                    line1: fs.shippingAddressLine1.value || null,
                    line2: fs.shippingAddressLine2.value || null,
                    city: fs.shippingCity.value || null,
                    state: fs.shippingState.value || null,
                },
            };
        }
        if (!addressFieldsByScope.billing)
            return null;
        const fs = state.fieldState;
        return {
            name: fs.name.value || null,
            address: {
                line1: fs.addressLine1.value || null,
                line2: fs.addressLine2.value || null,
                city: fs.city.value || null,
                state: fs.state.value || null,
            },
        };
    }
    /** The billing country/postal code slots, resolved for the "same as shipping" alias. */
    function billingCountryAndPostalCode() {
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
        if (!addressFieldsByScope.billing && !state.billingSameAsShipping)
            return null;
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
                country: country ? country : null,
            },
        };
    }
    /** The shipping details collected by a mounted shipping-scope address element. */
    function shippingDetails() {
        if (!addressFieldsByScope.shipping)
            return null;
        const fs = state.fieldState;
        return {
            name: fs.shippingName.value || null,
            phone: fs.shippingPhone.value || null,
            address: {
                line1: fs.shippingAddressLine1.value || null,
                line2: fs.shippingAddressLine2.value || null,
                city: fs.shippingCity.value || null,
                state: fs.shippingState.value || null,
                postal_code: fs.shippingPostalCode.value || null,
                country: fs.shippingCountry.value
                    ? fs.shippingCountry.value
                    : null,
            },
        };
    }
    /**
     * Persist the shipping address to the checkout session, if collected.
     * Returns an error message on failure, or null on success / when there is
     * no shipping address to persist.
     */
    async function updateShipping(sdk, signal) {
        const shipping_details = shippingDetails();
        if (!shipping_details)
            return null;
        const result = await sdk.checkoutSessions.update("current", { shipping_details }, { signal });
        return result.object === "error" ? result.error.message : null;
    }
    /**
     * Persist the billing address to the checkout session, if collected (or
     * aliased to shipping). Returns an error message on failure, or null on
     * success / when there is no billing address to persist.
     */
    async function updateBilling(sdk, signal) {
        const billing_details = billingDetailsForSave();
        if (!billing_details)
            return null;
        const result = await sdk.checkoutSessions.update("current", { billing_details }, { signal });
        return result.object === "error" ? result.error.message : null;
    }
    /**
     * Persist the collected email to the checkout session's customer_details,
     * if a contact details element is mounted. Returns an error message on
     * failure, or null on success / when there is no email to persist.
     */
    async function updateCustomerDetails(sdk, signal) {
        if (!collectsContactDetails)
            return null;
        const email = state.fieldState.email.value || null;
        const result = await sdk.checkoutSessions.update("current", { customer_details: { email } }, { signal });
        return result.object === "error" ? result.error.message : null;
    }
    async function createPayment(attemptGeneration, signal) {
        const stale = () => signal.aborted || attemptGeneration !== paymentAttemptGeneration;
        const fail = (error) => {
            if (attemptGeneration === paymentAttemptGeneration)
                failSubmit(error);
        };
        const complete = () => {
            if (attemptGeneration !== paymentAttemptGeneration)
                return;
            setState({ submitLoading: false, submitSuccess: true, paymentError: null });
            completionTimer = setTimeout(() => {
                if (attemptGeneration === paymentAttemptGeneration)
                    options.onComplete?.();
            }, SUBMIT_DELAY);
        };
        const { fieldState, encryptedFields, selectedPaymentMethod: method } = state;
        if (method === "card") {
            const { cardNumber: encryptedNumber, cardExpiry: encryptedExpiry, cardCvc: encryptedCvc, } = encryptedFields;
            const { country, postalCode } = billingCountryAndPostalCode();
            if (!encryptedNumber || !encryptedExpiry || !encryptedCvc) {
                fail("Missing payment method details.");
                return;
            }
            if (!country) {
                fail("Missing billing country.");
                return;
            }
            if (!postalCode && resolveAddressMetadata(country).postalCode.used) {
                fail("Missing billing postal code.");
                return;
            }
            const sdk = createSdk();
            const session = await sdk.checkoutSessions.get("current", undefined, { signal });
            if (stale())
                return;
            if (session.object === "error") {
                fail(session.error.message);
                return;
            }
            const shippingError = await updateShipping(sdk, signal);
            if (stale())
                return;
            if (shippingError) {
                fail(shippingError);
                return;
            }
            const billingError = await updateBilling(sdk, signal);
            if (stale())
                return;
            if (billingError) {
                fail(billingError);
                return;
            }
            const contactDetailsError = await updateCustomerDetails(sdk, signal);
            if (stale())
                return;
            if (contactDetailsError) {
                fail(contactDetailsError);
                return;
            }
            const address = addressBillingDetails();
            const payment = await sdk.payments.create({
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
                            country: country,
                            postal_code: postalCode || undefined,
                        },
                    },
                    setup_future_usage: session.mode === "setup" ? "off_session" : undefined,
                },
            }, { signal });
            if (stale())
                return;
            if (payment.object === "error") {
                fail(payment.error.message);
                return;
            }
            complete();
        }
        else if (method === "us_bank_account") {
            const { name, accountType } = fieldState;
            const { country, postalCode } = billingCountryAndPostalCode();
            const { bankAccountNumber: encryptedAccountNumber, bankRoutingNumber: encryptedRoutingNumber, } = encryptedFields;
            if (!encryptedAccountNumber || !encryptedRoutingNumber) {
                fail("Missing bank account details.");
                return;
            }
            const sdk = createSdk();
            const session = await sdk.checkoutSessions.get("current", undefined, { signal });
            if (stale())
                return;
            if (session.object === "error") {
                fail(session.error.message);
                return;
            }
            const shippingError = await updateShipping(sdk, signal);
            if (stale())
                return;
            if (shippingError) {
                fail(shippingError);
                return;
            }
            const billingError = await updateBilling(sdk, signal);
            if (stale())
                return;
            if (billingError) {
                fail(billingError);
                return;
            }
            const contactDetailsError = await updateCustomerDetails(sdk, signal);
            if (stale())
                return;
            if (contactDetailsError) {
                fail(contactDetailsError);
                return;
            }
            const address = addressBillingDetails();
            const payment = await sdk.payments.create({
                payment_method: {
                    us_bank_account: {
                        encrypted_routing_number: encryptedRoutingNumber,
                        encrypted_account_number: encryptedAccountNumber,
                        account_type: accountType.value,
                    },
                    billing_details: {
                        name: name.value || undefined,
                        address: {
                            ...address?.address,
                            country: country ? country : undefined,
                            postal_code: postalCode || undefined,
                        },
                    },
                    setup_future_usage: session.mode === "setup" ? "off_session" : undefined,
                },
            }, { signal });
            if (stale())
                return;
            if (payment.object === "error") {
                fail(payment.error.message);
                return;
            }
            complete();
        }
    }
    return {
        getState: () => state,
        cancel() {
            paymentAttemptGeneration++;
            paymentAttemptRequest?.abort();
            paymentAttemptRequest = undefined;
            if (completionTimer)
                clearTimeout(completionTimer);
            completionTimer = undefined;
            contactAutosaver.cancel();
            shippingAutosaver.cancel();
            billingAutosaver.cancel();
        },
        setFrameFieldState(type, nextState) {
            patchFieldState(type, nextState);
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
            paymentAttemptRequest?.abort();
            paymentAttemptRequest = undefined;
            touchedFields.clear();
            billingSameAsShippingTouched = false;
            setState({
                fieldState: createInitialFieldState(),
                encryptedFields: {},
                submitLoading: false,
                submitSuccess: false,
                paymentError: null,
                billingSameAsShipping: false,
            });
        },
        setFieldValue(type, value) {
            if (state.submitLoading || state.submitSuccess)
                return;
            touchedFields.add(type);
            applyFieldValue(type, value);
            scheduleAutosave(type);
        },
        validateField(type) {
            const current = state.fieldState[type];
            const next = getFieldValidationResult(type, current.value, { showRequired: touchedFields.has(type) });
            patchFieldState(type, {
                value: current.value,
                valid: next.valid,
                error: next.error,
            });
        },
        setValueFieldState(type, nextState) {
            patchFieldState(type, nextState);
        },
        registerFieldValidator(type, validator) {
            fieldValidators[type] = validator;
        },
        unregisterFieldValidator(type) {
            delete fieldValidators[type];
        },
        setSelectedPaymentMethod(method) {
            // Clear all field errors when switching methods
            const clearedFields = Object.fromEntries(Object.entries(state.fieldState).map(([key, val]) => [
                key,
                { ...val, error: null },
            ]));
            setState({
                selectedPaymentMethod: method,
                paymentError: null,
                fieldState: clearedFields,
            });
        },
        setAddressFields(scope, fields) {
            addressFieldsByScope[scope] =
                fields === null ? null : fields.map((f) => scopedField(f, scope));
            if (scope === "shipping")
                setState({ collectsShipping: fields !== null });
            else
                setState({ collectsAddress: fields !== null });
        },
        setContactDetailsFields(collects) {
            collectsContactDetails = collects;
            setState({ collectsContactDetails: collects });
        },
        setBillingSameAsShipping(value) {
            billingSameAsShippingTouched = true;
            setState({ billingSameAsShipping: value });
            if (!state.submitLoading && !state.submitSuccess)
                billingAutosaver.schedule();
        },
        async applyGeoDefaults() {
            if (geoDefaultsRequested)
                return;
            geoDefaultsRequested = true;
            const geo = await detectGeoLocation();
            const country = geo?.country;
            if (!country || !(country in COUNTRY_NAMES))
                return;
            const metadata = await loadAddressMetadata(country);
            const region = geo.region?.trim().toLowerCase();
            const match = region
                ? metadata.state.options.find((option) => option.name.toLowerCase() === region ||
                    option.key.toLowerCase() === region)
                : undefined;
            for (const scope of ["billing", "shipping"]) {
                const countryField = countryFieldForScope(scope);
                const stateField = scopedField("state", scope);
                if (touchedFields.has(countryField))
                    continue;
                if (state.fieldState[countryField].value !== country) {
                    applyFieldValue(countryField, country);
                }
                if (match &&
                    !touchedFields.has(stateField) &&
                    state.fieldState[countryField].value === country) {
                    applyFieldValue(stateField, match.key);
                }
            }
        },
        hydrateFromSession(session) {
            if (collectsContactDetails &&
                !touchedFields.has("email") &&
                session.customer_details.email) {
                touchedFields.add("email");
                applyFieldValue("email", session.customer_details.email);
            }
            const shipping = session.shipping_details;
            if (addressFieldsByScope.shipping && shipping) {
                if (shipping.address.country && !touchedFields.has("shippingCountry")) {
                    touchedFields.add("shippingCountry");
                    applyFieldValue("shippingCountry", shipping.address.country);
                }
                const values = {
                    shippingName: shipping.name ?? undefined,
                    shippingPhone: shipping.phone ?? undefined,
                    shippingAddressLine1: shipping.address.line1 ?? undefined,
                    shippingAddressLine2: shipping.address.line2 ?? undefined,
                    shippingCity: shipping.address.city ?? undefined,
                    shippingState: shipping.address.state ?? undefined,
                    shippingPostalCode: shipping.address.postal_code ?? undefined,
                };
                for (const [type, value] of Object.entries(values)) {
                    if (value && !touchedFields.has(type)) {
                        touchedFields.add(type);
                        applyFieldValue(type, value);
                    }
                }
            }
            const billing = session.billing_details;
            if (addressFieldsByScope.billing && billing) {
                if (billing.address.country && !touchedFields.has("country")) {
                    touchedFields.add("country");
                    applyFieldValue("country", billing.address.country);
                }
                const values = {
                    name: billing.name ?? undefined,
                    addressLine1: billing.address.line1 ?? undefined,
                    addressLine2: billing.address.line2 ?? undefined,
                    city: billing.address.city ?? undefined,
                    state: billing.address.state ?? undefined,
                    postalCode: billing.address.postal_code ?? undefined,
                };
                for (const [type, value] of Object.entries(values)) {
                    if (value && !touchedFields.has(type)) {
                        touchedFields.add(type);
                        applyFieldValue(type, value);
                    }
                }
            }
            // Infer the "same as shipping" checkbox state by comparing the
            // saved billing and shipping addresses, rather than persisting a
            // separate flag — the two scopes are considered equal once name
            // and every address field match.
            if (!billingSameAsShippingTouched &&
                billing &&
                shipping &&
                billing.name === shipping.name &&
                billing.address.line1 === shipping.address.line1 &&
                billing.address.line2 === shipping.address.line2 &&
                billing.address.city === shipping.address.city &&
                billing.address.state === shipping.address.state &&
                billing.address.postal_code === shipping.address.postal_code &&
                billing.address.country === shipping.address.country) {
                billingSameAsShippingTouched = true;
                setState({ billingSameAsShipping: true });
            }
        },
        async autocompleteAddress(input, country, signal) {
            try {
                const result = await createSdk().checkout.address.autocomplete({ input, country: country }, { signal });
                return Array.isArray(result) ? result : [];
            }
            catch {
                return [];
            }
        },
        getRequiredFrameFields() {
            return requiredFrameFields();
        },
        getRequiredValueFields() {
            return requiredValueFields();
        },
        isSubmittable() {
            return (requiredFrameFields().every((f) => !!state.encryptedFields[f]) &&
                requiredValueFields().every((f) => state.fieldState[f].valid));
        },
        attemptPayment({ triggerFrameValidation }) {
            if (state.submitLoading || state.submitSuccess)
                return;
            const autosavesSettled = Promise.all([
                contactAutosaver.cancel(),
                shippingAutosaver.cancel(),
                billingAutosaver.cancel(),
            ]);
            setState({
                paymentError: null,
                submitLoading: true,
                submitSuccess: false,
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
                const current = state.fieldState[field];
                const result = getFieldValidationResult(field, current.value, { showRequired: true });
                nextFieldState[field] = {
                    ...current,
                    valid: result.valid,
                    error: result.error,
                };
                if (!result.valid)
                    allValueFieldsValid = false;
            }
            setState({ fieldState: nextFieldState });
            if (frameFields.every((f) => !!state.encryptedFields[f]) && allValueFieldsValid) {
                const attemptGeneration = ++paymentAttemptGeneration;
                paymentAttemptRequest?.abort();
                const request = new AbortController();
                paymentAttemptRequest = request;
                void autosavesSettled.then(() => {
                    if (attemptGeneration !== paymentAttemptGeneration || request.signal.aborted)
                        return;
                    void createPayment(attemptGeneration, request.signal).catch(() => {
                        if (attemptGeneration === paymentAttemptGeneration &&
                            !request.signal.aborted) {
                            failSubmit("The payment request failed.");
                        }
                    });
                });
                return;
            }
            failSubmit();
        },
        setApiBaseUrl(url) {
            apiBaseUrl = url;
        },
    };
}
