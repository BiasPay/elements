import { Bias, type CheckoutSession } from "@biaspay/sdk";
import {
    getAddressMetadata,
    getAddressMetadataStatus,
    loadAddressMetadata,
    resolveAddressMetadata,
} from "./address-metadata";
import type {
    ElementsConfig,
    ElementsController,
    InternalCollector,
    InternalFieldBinding,
    InternalFrameBinding,
    InternalFrameStateBinding,
} from "./adapter";
import { createBiasStore, type BiasStoreMethods, type BiasStoreState } from "./BiasStore";
import { elementsError, normalizeSessionError } from "./errors";
import { resolveElementsConfig, type ResolvedElementsConfig } from "./endpoints";
import type {
    AddressMetadataState,
    AddressScope,
    BiasElementsError,
    BiasElementsState,
    BiasFieldName,
    BiasFieldValidator,
    BiasFieldValueMap,
    PaymentMethod,
    SessionState,
    SubmissionStatus,
} from "./public-types";
import {
    scopedField,
    type FieldValueMap,
    type FrameFieldType,
    type ValueFieldStatus,
    type ValueFieldType,
} from "./types";

function warnInactive(operation: string) {
    console.warn(`Bias Elements: ${operation}() was ignored because the controller is inactive.`);
}

function supportedMethods(session: CheckoutSession | undefined): PaymentMethod[] {
    if (!session) return [];
    // Older private test fixtures omitted this required API property. Treat them as
    // card-only; an explicitly empty list remains a configuration error.
    const values: unknown = session.payment_method_types ?? ["card"];
    if (!Array.isArray(values)) return [];
    return values.filter(
        (method): method is PaymentMethod => method === "card" || method === "us_bank_account",
    );
}

/** Framework-neutral controller. Renderer-only state stays behind this facade. */
export class BiasController implements ElementsController {
    private config: ResolvedElementsConfig;
    private storeState: BiasStoreState;
    private readonly store: BiasStoreMethods;
    private readonly listeners = new Set<() => void>();
    private sessionState: SessionState = { status: "idle" };
    private paymentMethod: PaymentMethod | undefined;
    private submissionStatus: SubmissionStatus = "idle";
    private submissionError: BiasElementsError | null = null;
    private active = false;
    private generation = 0;
    private request: AbortController | undefined;
    private initialSeedConsumed = false;
    private completionGeneration = -1;
    private readonly collectors = new Map<symbol, InternalCollector>();
    private readonly frames = new Map<symbol, InternalFrameBinding>();
    private readonly validatorTokens = new Map<ValueFieldType, symbol>();
    private paymentSurface: { token: symbol; method?: PaymentMethod } | undefined;
    private reconcilingSubmission = false;
    private suppressSubmissionTransitions = false;
    private terminalError: BiasElementsError | undefined;

    constructor(config: ElementsConfig) {
        this.config = resolveElementsConfig(config);
        let initial!: BiasStoreState;
        this.store = createBiasStore({
            clientSecret: () => this.config.clientSecret,
            apiBaseUrl: this.config.apiBaseUrl,
            onChange: (next) => this.onStoreChange(next),
            onComplete: () => this.complete(),
        });
        initial = this.store.getState();
        this.storeState = initial;
    }

    getPublicState(): BiasElementsState {
        return {
            sessionState: this.sessionState,
            paymentMethod: this.paymentMethod,
            status: this.submissionStatus,
            canSubmit: this.canSubmit(),
            submissionError: this.submissionError,
        };
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        if (!this.active) return;
        for (const listener of this.listeners) listener();
    }

    activate() {
        if (this.active) return;
        this.active = true;
        if (this.terminalError) {
            this.notify();
            return;
        }
        const generation = ++this.generation;
        this.submissionStatus = "idle";
        this.submissionError = null;
        const seed = !this.initialSeedConsumed ? this.config.initialCheckoutSession : undefined;
        this.initialSeedConsumed = true;
        if (seed && seed.client_secret !== this.config.clientSecret) {
            this.setTerminalError(
                elementsError(
                    "configuration_error",
                    "initialCheckoutSession does not belong to clientSecret.",
                ),
            );
            return;
        }
        this.applyRegistrations();
        void this.store.applyGeoDefaults();
        if (seed) this.applySession(seed);
        void this.fetchSession(generation);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.generation++;
        this.request?.abort();
        this.request = undefined;
        this.store.cancel();
        for (const frame of this.frames.values()) frame.dispose?.();
        this.frames.clear();
        this.collectors.clear();
        this.paymentSurface = undefined;
        this.listeners.clear();
    }

    updateConfig(next: ElementsConfig) {
        const previous = this.config;
        const resolvedNext = resolveElementsConfig(next);
        this.config = resolvedNext;
        const identityChanged =
            previous.clientSecret !== resolvedNext.clientSecret ||
            previous.apiBaseUrl !== resolvedNext.apiBaseUrl;
        const frameChanged = previous.frameUrl !== resolvedNext.frameUrl;

        if (
            resolvedNext.initialCheckoutSession !== previous.initialCheckoutSession &&
            !identityChanged
        ) {
            console.warn(
                "Bias Elements: a later initialCheckoutSession was ignored for the current checkout session.",
            );
        }
        if (!identityChanged && !frameChanged) {
            this.notify(); // onComplete and appearance are configuration-owned and update in place.
            return;
        }

        this.generation++;
        this.request?.abort();
        this.request = undefined;
        this.store.cancel();
        const ambiguousFrameChange = frameChanged && this.submissionStatus === "submitting";
        if (!ambiguousFrameChange) {
            this.submissionStatus = "idle";
            this.submissionError = null;
        }
        this.reconcilingSubmission = ambiguousFrameChange;
        this.completionGeneration = -1;

        if (identityChanged) {
            this.terminalError = undefined;
            this.initialSeedConsumed = true;
            this.sessionState = this.active ? { status: "loading" } : { status: "idle" };
            this.paymentMethod = undefined;
            this.store.setApiBaseUrl(resolvedNext.apiBaseUrl);
            this.store.resetSessionFields();
        } else {
            this.suppressSubmissionTransitions = ambiguousFrameChange;
            this.store.resetFrameFields();
            this.suppressSubmissionTransitions = false;
        }
        this.notify();
        if (this.active && identityChanged) void this.fetchSession(this.generation);
        if (this.active && ambiguousFrameChange) void this.fetchSession(this.generation);
    }

    refreshSession() {
        if (!this.active) {
            warnInactive("refreshSession");
            return;
        }
        if (this.submissionStatus === "submitting" || this.submissionStatus === "succeeded") return;
        void this.fetchSession(this.generation);
    }

    setPaymentMethod(method: PaymentMethod) {
        if (!this.active) {
            warnInactive("setPaymentMethod");
            return;
        }
        if (this.submissionStatus === "submitting" || this.submissionStatus === "succeeded") return;
        if (!supportedMethods(this.checkoutSession()).includes(method)) {
            console.warn(
                `Bias Elements: payment method "${method}" is not enabled for this session.`,
            );
            return;
        }
        if (this.paymentMethod === method) return;
        this.paymentMethod = method;
        this.store.setSelectedPaymentMethod(method);
        this.clearFailedSubmission();
        this.notify();
    }

    submit() {
        if (!this.active) {
            warnInactive("submit");
            return;
        }
        if (
            !this.paymentMethod ||
            this.submissionStatus === "submitting" ||
            this.submissionStatus === "succeeded"
        )
            return;
        this.submissionStatus = "submitting";
        this.submissionError = null;
        this.notify();
        this.store.attemptPayment({
            triggerFrameValidation: (field) => {
                for (const binding of this.frames.values()) {
                    if (binding.field === field) binding.triggerValidation();
                }
            },
        });
    }

    getField<K extends BiasFieldName>(
        name: K,
        scope: AddressScope = "billing",
    ): InternalFieldBinding<K> {
        const slot = this.resolveField(name, scope);
        const state = () =>
            this.storeState.fieldState[slot] as ValueFieldStatus<BiasFieldValueMap[K]>;
        return {
            get state() {
                return {
                    value: state().value,
                    isFocused: state().focused,
                    isValid: state().valid,
                    error: state().error,
                };
            },
            setValue: (value) => {
                if (!this.active) return warnInactive("setValue");
                if (this.submissionStatus === "submitting" || this.submissionStatus === "succeeded")
                    return;
                this.store.setFieldValue(slot, value as FieldValueMap[typeof slot]);
            },
            setValidator: (validator: BiasFieldValidator<K>) =>
                this.registerValidator(slot, validator),
            validate: () => {
                if (this.active) this.store.validateField(slot);
            },
            onFocus: () => {
                if (this.active) this.store.setValueFieldState(slot, { focused: true });
            },
            onBlur: () => {
                if (!this.active) return;
                this.store.setValueFieldState(slot, { focused: false });
                this.store.validateField(slot);
            },
        };
    }

    getFrame(field: FrameFieldType): InternalFrameStateBinding {
        const state = () => this.storeState.fieldState[field];
        const clientSecret = () => this.config.clientSecret;
        const frameUrl = () => this.config.frameUrl;
        const key = () => `${this.config.clientSecret}:${this.config.apiBaseUrl}:${frameUrl()}`;
        return {
            get state() {
                return state();
            },
            get clientSecret() {
                return clientSecret();
            },
            get frameUrl() {
                return frameUrl();
            },
            get key() {
                return key();
            },
            setState: (next) => {
                if (this.active) this.store.setFrameFieldState(field, next);
            },
            setEncryptedData: (value) => {
                if (this.active) this.store.onEncryptedData(field, value);
            },
        };
    }

    autocompleteAddress(input: string, country: string | undefined, signal: AbortSignal) {
        if (!this.active) {
            warnInactive("autocompleteAddress");
            return Promise.resolve([]);
        }
        return this.store.autocompleteAddress(input, country, signal);
    }

    getBillingSameAsShipping(): boolean {
        return this.storeState.billingSameAsShipping;
    }

    setBillingSameAsShipping(value: boolean) {
        if (!this.active) return warnInactive("setBillingSameAsShipping");
        if (this.submissionStatus === "submitting" || this.submissionStatus === "succeeded") return;
        this.store.setBillingSameAsShipping(value);
    }

    hasCollector(kind: "contact" | "address", scope?: AddressScope): boolean {
        return [...this.collectors.values()].some((collector) => {
            if (kind === "contact") return collector.kind === "contact";
            return collector.kind === "address" && collector.scope === scope;
        });
    }

    registerCollector(collector: InternalCollector): () => void {
        const token = Symbol(collector.kind);
        this.collectors.set(token, collector);
        if (this.active) this.applyRegistrations();
        return () => {
            if (!this.collectors.delete(token) || !this.active) return;
            this.applyRegistrations();
        };
    }

    registerFrame(binding: InternalFrameBinding): () => void {
        const token = Symbol(binding.field);
        this.frames.set(token, binding);
        return () => {
            if (!this.frames.delete(token)) return;
            binding.dispose?.();
        };
    }

    registerPaymentElement(method?: PaymentMethod): () => void {
        if (this.paymentSurface) {
            const error = elementsError(
                "configuration_error",
                "Only one PaymentElement, CardElement, or USBankAccountElement may be mounted per provider.",
            );
            this.setTerminalError(error);
            throw error;
        }
        const token = Symbol("payment-surface");
        this.paymentSurface = { token, method };
        if (
            method &&
            this.checkoutSession() &&
            !supportedMethods(this.checkoutSession()).includes(method)
        ) {
            this.paymentSurface = undefined;
            const error = elementsError(
                "configuration_error",
                `The mounted payment form uses "${method}", which is not enabled for this session.`,
            );
            this.setTerminalError(error);
            throw error;
        }
        if (method && this.active) this.setPaymentMethod(method);
        return () => {
            if (this.paymentSurface?.token === token) this.paymentSurface = undefined;
        };
    }

    getAddressMetadata(scope: AddressScope): AddressMetadataState {
        const country = this.storeState.fieldState[scopedField("country", scope)].value;
        return this.getAddressMetadataForCountry(country);
    }

    getAddressMetadataForCountry(country: string): AddressMetadataState {
        const metadata = getAddressMetadata(country);
        const status = getAddressMetadataStatus(country);
        if (metadata && status !== "loading") return { status, metadata };
        if (this.active) {
            const generation = this.generation;
            void loadAddressMetadata(country).then(() => {
                if (this.active && this.generation === generation) this.notify();
            });
        }
        const fallback = resolveAddressMetadata(country);
        return country.toUpperCase() === "ZZ"
            ? { status: "fallback", metadata: fallback }
            : { status: "loading", metadata: fallback };
    }

    private checkoutSession(): CheckoutSession | undefined {
        return "session" in this.sessionState ? this.sessionState.session : undefined;
    }

    private canSubmit(): boolean {
        return (
            this.active &&
            !this.reconcilingSubmission &&
            this.sessionState.status !== "loading" &&
            this.sessionState.status !== "idle" &&
            !!this.paymentMethod &&
            this.submissionStatus !== "submitting" &&
            this.submissionStatus !== "succeeded" &&
            this.store.isSubmittable()
        );
    }

    private async fetchSession(generation: number) {
        if (!this.active || generation !== this.generation || this.request) return;
        if (!this.config.clientSecret) {
            this.setTerminalError(elementsError("authentication_failed"));
            return;
        }
        const previous = this.checkoutSession();
        this.sessionState = previous
            ? { status: "refreshing", session: previous }
            : { status: "loading" };
        this.notify();
        const owner = {
            generation,
            clientSecret: this.config.clientSecret,
            apiBaseUrl: this.config.apiBaseUrl,
        };
        const request = new AbortController();
        this.request = request;
        try {
            const sdk = new Bias({ apiKey: owner.clientSecret, baseURL: owner.apiBaseUrl });
            const result = await (sdk.checkoutSessions.get as any)("current", undefined, {
                signal: request.signal,
            });
            if (!this.owns(owner) || request.signal.aborted) return;
            if (result.object === "error") throw result.error;
            this.applySession(result);
        } catch (cause) {
            if (!this.owns(owner) || request.signal.aborted) return;
            const error = normalizeSessionError(cause);
            if (previous) {
                this.sessionState = { status: "error", error, session: previous };
                this.notify();
            } else {
                this.setTerminalError(error);
            }
        } finally {
            if (this.request === request) this.request = undefined;
        }
    }

    private owns(owner: { generation: number; clientSecret: string; apiBaseUrl: string }) {
        return (
            this.active &&
            this.generation === owner.generation &&
            this.config.clientSecret === owner.clientSecret &&
            this.config.apiBaseUrl === owner.apiBaseUrl
        );
    }

    private applySession(session: CheckoutSession) {
        const methods = supportedMethods(session);
        if (methods.length === 0) {
            this.setTerminalError(
                elementsError(
                    "configuration_error",
                    "The checkout session has no supported payment methods.",
                ),
            );
            return;
        }
        const fixedMethod = this.paymentSurface?.method;
        if (fixedMethod && !methods.includes(fixedMethod)) {
            this.setTerminalError(
                elementsError(
                    "configuration_error",
                    `The mounted payment form uses "${fixedMethod}", which is not enabled for this session.`,
                ),
            );
            return;
        }
        this.sessionState = { status: "ready", session };
        if (this.reconcilingSubmission) {
            this.reconcilingSubmission = false;
            if (Array.isArray(session.payments) && session.payments.length > 0) {
                this.submissionStatus = "succeeded";
                this.submissionError = null;
                this.notify();
                this.complete();
                return;
            }
            this.submissionStatus = "failed";
            this.submissionError = elementsError(
                "payment_failed",
                "The payment result was reconciled and may now be retried.",
            );
        }
        const nextMethod =
            fixedMethod ??
            (this.paymentMethod && methods.includes(this.paymentMethod)
                ? this.paymentMethod
                : methods[0]);
        this.paymentMethod = nextMethod;
        this.store.setSelectedPaymentMethod(nextMethod!);
        this.store.hydrateFromSession(session);
        this.notify();
    }

    private setTerminalError(error: BiasElementsError) {
        this.terminalError = error;
        this.sessionState = { status: "error", error };
        this.paymentMethod = undefined;
        this.notify();
    }

    private onStoreChange(next: BiasStoreState) {
        const fieldEdited = this.relevantFieldChanged(this.storeState, next);
        this.storeState = next;
        if (this.suppressSubmissionTransitions) {
            this.notify();
            return;
        }
        if (next.submitSuccess) {
            this.submissionStatus = "succeeded";
            this.submissionError = null;
        } else if (this.submissionStatus === "submitting" && !next.submitLoading) {
            if (next.paymentError) {
                this.submissionStatus = "failed";
                this.submissionError = elementsError("payment_failed");
            } else {
                this.submissionStatus = "idle"; // validation-only failure
            }
        } else if (fieldEdited && this.submissionStatus === "failed") {
            this.clearFailedSubmission();
        }
        this.notify();
    }

    private clearFailedSubmission() {
        if (this.submissionStatus !== "failed") return;
        this.submissionStatus = "idle";
        this.submissionError = null;
    }

    private relevantFieldChanged(previous: BiasStoreState, next: BiasStoreState): boolean {
        for (const [name, state] of Object.entries(previous.fieldState)) {
            const nextState = next.fieldState[name as keyof typeof next.fieldState];
            if ("value" in state && "value" in nextState && state.value !== nextState.value)
                return true;
        }
        for (const field of Object.keys({
            ...previous.encryptedFields,
            ...next.encryptedFields,
        }) as FrameFieldType[]) {
            if (previous.encryptedFields[field] !== next.encryptedFields[field]) return true;
        }
        return false;
    }

    private complete() {
        if (!this.active || this.submissionStatus !== "succeeded") return;
        if (this.completionGeneration === this.generation) return;
        this.completionGeneration = this.generation;
        try {
            this.config.onComplete?.();
        } catch {
            // Consumer callback failures cannot change controller state or replay completion.
        }
    }

    private resolveField(name: BiasFieldName, scope: AddressScope): ValueFieldType {
        if (name.startsWith("shipping")) return name as ValueFieldType;
        return scopedField(name as ValueFieldType, scope);
    }

    private registerValidator<K extends BiasFieldName>(
        slot: ValueFieldType,
        validator: BiasFieldValidator<K>,
    ): () => void {
        const token = Symbol(slot);
        // The store deliberately rejects replacement. A token makes cleanup
        // instance-safe and prevents one owner from deleting another's validator.
        if (this.validatorTokens.has(slot)) {
            throw elementsError("configuration_error", `Field "${slot}" already has a validator.`);
        }
        this.validatorTokens.set(slot, token);
        this.store.registerFieldValidator(slot, ((value: BiasFieldValueMap[K]) => {
            const result = validator(value);
            return { valid: result.isValid, error: result.error };
        }) as any);
        return () => {
            if (this.validatorTokens.get(slot) !== token) return;
            this.validatorTokens.delete(slot);
            this.store.unregisterFieldValidator(slot);
        };
    }

    private applyRegistrations() {
        for (const scope of ["billing", "shipping"] as const) {
            const fields = [...this.collectors.values()].flatMap((collector) =>
                collector.kind === "address" && collector.scope === scope ? collector.fields : [],
            );
            this.store.setAddressFields(scope, fields.length ? [...new Set(fields)] : null);
        }
        this.store.setContactDetailsFields(
            [...this.collectors.values()].some((collector) => collector.kind === "contact"),
        );
    }
}

export type { ElementsConfig as BiasControllerConfig } from "./adapter";
