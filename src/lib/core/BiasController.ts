import type { ApplePayPaymentData, CheckoutSession as PublicCheckoutSession } from "@biaspay/sdk";
import {
    Bias,
    type CheckoutSession,
    type CheckoutWalletApplePayUpdateParams,
    type CountryCode,
    type Error as ApiError,
    type Event,
    type Payment,
    type PaymentMethodCreateBillingDetails,
} from "@biaspay/sdk-checkout";
import {
    COUNTRY_NAMES,
    getAddressMetadata,
    getAddressMetadataStatus,
    loadAddressMetadata,
    resolveAddressMetadata,
} from "./address-metadata";
import type {
    ApplePayAuthorizationResult,
    ApplePayContact,
    ApplePayPresentation,
    ApplePayPresentationUpdate,
    ApplePayShippingMethod,
    ApplePayWalletConfig,
    ElementsConfig,
    ElementsController,
    InternalCollector,
    InternalFieldBinding,
    InternalFrameBinding,
    InternalFrameStateBinding,
} from "./adapter";
import { createBiasStore, type BiasStoreMethods, type BiasStoreState } from "./BiasStore";
import {
    CHECKOUT_TOTALS_CHANGED_MESSAGE,
    elementsError,
    normalizeSessionError,
    PAYMENT_NOT_COMPLETED_MESSAGE,
} from "./errors";
import {
    mergeCheckoutSessionExpand,
    resolveElementsConfig,
    structurallyEqual,
    type ResolvedElementsConfig,
} from "./endpoints";
import type {
    AddressMetadataState,
    AddressScope,
    BiasElementsError,
    BiasElementsState,
    BiasFieldName,
    BiasFieldValidator,
    BiasFieldValueMap,
    ConventionalPaymentMethod,
    DiscountCodeAction,
    PaymentMethod,
    SavedPaymentMethod,
    SessionPaymentMethod,
    SessionState,
    ShopperCheckoutSessionUpdateParams,
    SubmissionStatus,
    WalletAvailability,
    WalletAvailabilityStatus,
    WalletPaymentMethod,
} from "./public-types";
import { checkoutAmountRemaining, subscriptionFreeToday } from "./payable";
import {
    classifyPaymentStatus,
    createIdempotencyKey,
    describePaymentError,
    classifyIdempotencyError,
    failedPaymentMessage,
    PAYMENT_UNCONFIRMED_MESSAGE,
    setupMessage,
    shopperErrorMessage,
    sessionPaymentIds,
    type ObservedPayment,
    type PaymentAttempt,
    type PaymentFailure,
} from "./payment-outcome";
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

const toPublicSession = (session: CheckoutSession) => session as unknown as PublicCheckoutSession;
const fromPublicSession = (session: PublicCheckoutSession) => session as unknown as CheckoutSession;

function sessionMethods(session: CheckoutSession | undefined): SessionPaymentMethod[] {
    if (!session) return [];
    // Older private test fixtures omitted this required API property. Treat them as
    // card-only; an explicitly empty list remains a configuration error.
    const values: unknown = session.payment_method_types ?? ["card"];
    if (!Array.isArray(values)) return [];
    return values.filter(
        (method): method is SessionPaymentMethod =>
            method === "card" || method === "us_bank_account" || method === "apple_pay",
    );
}

function isConventionalMethod(method: unknown): method is ConventionalPaymentMethod {
    return method === "card" || method === "us_bank_account";
}

function conventionalMethods(session: CheckoutSession | undefined): PaymentMethod[] {
    return sessionMethods(session).filter(isConventionalMethod);
}

function walletMethods(session: CheckoutSession | undefined): WalletPaymentMethod[] {
    return sessionMethods(session).filter(
        (method): method is WalletPaymentMethod => method === "apple_pay",
    );
}

function isApiError(result: CheckoutSession | ApiError): result is ApiError {
    return result.object === "error";
}

function sessionCurrency(session: CheckoutSession, fallback: string): string {
    const currency = (session as CheckoutSession & { currency?: unknown }).currency;
    return typeof currency === "string" && currency ? currency : fallback;
}

/** The Apple Pay sheet amount: exactly what the API requires an Apple Pay payment to send. */
function applePayPayableAmount(session: CheckoutSession): number {
    return checkoutAmountRemaining(session, "apple_pay");
}

function expandedPayments(session: CheckoutSession | undefined): Payment[] {
    return (session?.payments ?? []).filter((payment): payment is Payment =>
        Boolean(payment && typeof payment === "object" && "id" in payment && "status" in payment),
    );
}

/**
 * The payment an unreplayable attempt may have created: one that wasn't on the session
 * when the attempt was dispatched, for the amount it sent. Unknown without a snapshot.
 */
function attemptPaymentOnSession(
    attempt: PaymentAttempt,
    session: CheckoutSession,
): Payment | undefined {
    const known = attempt.knownPaymentIds;
    if (!known) return undefined;
    return expandedPayments(session).find(
        (payment) =>
            !known.includes(payment.id) &&
            (attempt.sentAmount === undefined || payment.amount === attempt.sentAmount),
    );
}

function applePayShippingMethods(session: CheckoutSession): ApplePayShippingMethod[] {
    const methods = (session.shipping_options ?? []).flatMap((option) => {
        const rate = option.shipping_rate;
        if (typeof rate === "string") return [];
        const estimate = rate.delivery_estimate;
        const minimum = estimate?.minimum;
        const maximum = estimate?.maximum;
        const formatBound = (bound: NonNullable<typeof minimum>) =>
            `${bound.value} ${bound.unit.replaceAll("_", " ")}${bound.value === 1 ? "" : "s"}`;
        const detail =
            minimum && maximum
                ? `${formatBound(minimum)}–${formatBound(maximum)}`
                : minimum
                  ? `From ${formatBound(minimum)}`
                  : maximum
                    ? `Up to ${formatBound(maximum)}`
                    : "";
        return [
            {
                identifier: rate.id,
                label: rate.display_name,
                detail,
                amount: option.shipping_amount,
            },
        ];
    });
    const selectedRate = selectedApplePayShippingRate(session);
    const selectedIndex = methods.findIndex((method) => method.identifier === selectedRate);
    if (selectedIndex <= 0) return methods;
    return [
        methods[selectedIndex]!,
        ...methods.slice(0, selectedIndex),
        ...methods.slice(selectedIndex + 1),
    ];
}

function selectedApplePayShippingRate(session: CheckoutSession): string | undefined {
    const rate = session.shipping_cost?.shipping_rate;
    return typeof rate === "string" ? rate : rate?.id;
}

function normalizeCountryCode(value: unknown): CountryCode | undefined {
    const code = cleanContactValue(value, 2)?.toUpperCase();
    return code && Object.hasOwn(COUNTRY_NAMES, code) ? (code as CountryCode) : undefined;
}

function cleanContactValue(value: unknown, maxLength: number): string | undefined {
    if (typeof value !== "string") return undefined;
    const cleaned = value.trim().slice(0, maxLength);
    return cleaned || undefined;
}

function normalizeApplePayBillingContact(
    contact: ApplePayContact | undefined,
): PaymentMethodCreateBillingDetails | undefined {
    if (!contact) return undefined;
    const givenName = cleanContactValue(contact.givenName, 100);
    const familyName = cleanContactValue(contact.familyName, 100);
    const name = [givenName, familyName].filter(Boolean).join(" ") || undefined;
    const email = cleanContactValue(contact.emailAddress, 320);
    const lines = Array.isArray(contact.addressLines)
        ? contact.addressLines
              .slice(0, 2)
              .map((line) => cleanContactValue(line, 200))
              .filter((line): line is string => Boolean(line))
        : [];
    const locality = cleanContactValue(contact.locality, 100);
    const state = cleanContactValue(contact.administrativeArea, 100);
    const postalCode = cleanContactValue(contact.postalCode, 32);
    const country = normalizeCountryCode(contact.countryCode);
    const hasAddress = lines.length > 0 || Boolean(locality || state || postalCode || country);
    if (!name && !email && !hasAddress) return undefined;
    return {
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
        ...(hasAddress
            ? {
                  address: {
                      ...(lines[0] ? { line1: lines[0] } : {}),
                      ...(lines[1] ? { line2: lines[1] } : {}),
                      ...(locality ? { city: locality } : {}),
                      ...(state ? { state } : {}),
                      ...(postalCode ? { postal_code: postalCode } : {}),
                      ...(country ? { country } : {}),
                  },
              }
            : {}),
    };
}

function mergeApplePayBillingDetails(
    session: CheckoutSession,
    contact: ApplePayContact | undefined,
): PaymentMethodCreateBillingDetails | undefined {
    const wallet = normalizeApplePayBillingContact(contact);
    const canonical = session.billing_details;
    const canonicalCountry = normalizeCountryCode(canonical?.address.country);
    const canonicalAddress = canonical
        ? {
              ...(canonical.address.line1 ? { line1: canonical.address.line1 } : {}),
              ...(canonical.address.line2 ? { line2: canonical.address.line2 } : {}),
              ...(canonical.address.city ? { city: canonical.address.city } : {}),
              ...(canonical.address.state ? { state: canonical.address.state } : {}),
              ...(canonical.address.postal_code
                  ? { postal_code: canonical.address.postal_code }
                  : {}),
              ...(canonicalCountry ? { country: canonicalCountry } : {}),
          }
        : undefined;
    const address = { ...canonicalAddress, ...wallet?.address };
    const name = wallet?.name ?? canonical?.name ?? undefined;
    const email = wallet?.email;
    if (!name && !email && Object.keys(address).length === 0) return undefined;
    return {
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
        ...(Object.keys(address).length > 0 ? { address } : {}),
    };
}

type ApplePayWireContact = NonNullable<CheckoutWalletApplePayUpdateParams["shipping_contact"]>;

function applePayContactForWire(contact: ApplePayContact): ApplePayWireContact {
    const nativeContact = contact as ApplePayContact & Record<string, unknown>;
    const stringField = (key: keyof ApplePayContact) =>
        typeof nativeContact[key] === "string" ? (nativeContact[key] as string) : undefined;
    const addressLines = Array.isArray(nativeContact.addressLines)
        ? nativeContact.addressLines
              .filter((line): line is string => typeof line === "string")
              .slice(0, 2)
        : undefined;
    return {
        ...(stringField("givenName") ? { givenName: stringField("givenName") } : {}),
        ...(stringField("familyName") ? { familyName: stringField("familyName") } : {}),
        ...(stringField("emailAddress") ? { emailAddress: stringField("emailAddress") } : {}),
        ...(stringField("phoneNumber") ? { phoneNumber: stringField("phoneNumber") } : {}),
        ...(addressLines?.length ? { addressLines } : {}),
        ...(stringField("locality") ? { locality: stringField("locality") } : {}),
        ...(stringField("administrativeArea")
            ? { administrativeArea: stringField("administrativeArea") }
            : {}),
        ...(stringField("postalCode") ? { postalCode: stringField("postalCode") } : {}),
        ...(stringField("countryCode") ? { countryCode: stringField("countryCode") } : {}),
    };
}

type ApplePayUpdateInput = Omit<CheckoutWalletApplePayUpdateParams, "checkout_session_updated_at">;
type ApplePayUpdateInputSource = ApplePayUpdateInput | (() => ApplePayUpdateInput | null);

function isCheckoutTotalsChanged(value: unknown): boolean {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    if (record.status === 409 || record.code === "checkout_totals_changed") return true;
    return isCheckoutTotalsChanged(record.error);
}

function formatDiscountCodeError(error: ApiError): string {
    return error.error.customer_message || "This discount code couldn't be applied.";
}

function createFrameGroupId(): string {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export const COMPLETION_DELAY_MS = 1_000;
const EVENT_RETRY_INITIAL_MS = 1_000;
const EVENT_RETRY_MAX_MS = 30_000;
/**
 * Delays between steps that resolve a payment whose outcome is unknown. Once this
 * bounded schedule is exhausted the attempt is shown as `processing` instead of
 * `submitting`, and resolution continues at the capped delay.
 */
const PAYMENT_RESOLUTION_RETRY_MS = [250, 500, 1_000, 2_000, 4_000, 8_000] as const;
const PAYMENT_RESOLUTION_MAX_RETRY_MS = 30_000;
/**
 * Session reads that look for the outcome of an attempt its idempotency key can't
 * replay (about three minutes). Once they run out, the attempt fails as unconfirmed
 * and the form unlocks.
 */
const PAYMENT_RECONCILE_DELAYS_MS = [
    1_000, 2_000, 4_000, 8_000, 15_000, 30_000, 30_000, 30_000, 30_000, 30_000,
] as const;

/**
 * A dispatched payment request whose outcome is not known yet. Until the API has
 * answered, the identical request is re-sent with the attempt's idempotency key: the
 * API replays the original response (or reports that the original is still running),
 * and a request that never reached it is processed once. Once the API has created a
 * still-pending payment, that payment is followed on the session until it is final.
 */
type PaymentResolution = {
    readonly attempt: PaymentAttempt;
    readonly owner: { readonly clientSecret: string; readonly apiBaseUrl: string };
    readonly request: AbortController;
    paymentId: string | undefined;
    /**
     * The key can't replay the original request: until its payment is found, the
     * outcome is looked for on the session (complete, or a new payment for the sent
     * amount) for a bounded time.
     */
    reconcile: boolean;
    retryCount: number;
    timer: ReturnType<typeof setTimeout> | undefined;
};

function waitForRetry(delay: number, signal: AbortSignal) {
    if (signal.aborted) return Promise.resolve();
    return new Promise<void>((resolve) => {
        const finish = () => {
            clearTimeout(timeout);
            signal.removeEventListener("abort", finish);
            resolve();
        };
        const timeout = setTimeout(finish, delay);
        signal.addEventListener("abort", finish, { once: true });
    });
}

/** Framework-neutral controller. Renderer-only state stays behind this facade. */
export class BiasController implements ElementsController {
    private config: ResolvedElementsConfig;
    private storeState: BiasStoreState;
    private readonly store: BiasStoreMethods;
    private readonly listeners = new Set<() => void>();
    /** Shared by this checkout's secure fields so frames of other checkouts stay isolated. */
    private readonly frameGroup = createFrameGroupId();
    private sessionState: SessionState<CheckoutSession> = { status: "idle" };
    private paymentSelectionTouched = false;
    private submissionStatus: SubmissionStatus = "idle";
    private submissionError: BiasElementsError | null = null;
    private presentingWallet: WalletPaymentMethod | undefined;
    private walletAvailability: WalletAvailability = { applePay: "loading" };
    private applePayConfig: ApplePayWalletConfig | undefined;
    private applePayPresentation: ApplePayPresentation | undefined;
    private applePayPresentationRequest: AbortController | undefined;
    private applePayUpdateQueue: Promise<void> = Promise.resolve();
    private walletConfigurationRequest: AbortController | undefined;
    /** The payment attempt whose outcome is being resolved; it locks submission. */
    private paymentResolution: PaymentResolution | undefined;
    /** The Apple Pay payment request while it is dispatched but unanswered. */
    private walletPaymentInFlight: PaymentAttempt | undefined;
    /** Set while a refused payment's message is prepared after its attempt was cancelled. */
    private answeredFailureToken: object | undefined;
    private active = false;
    private generation = 0;
    private request: AbortController | undefined;
    private eventRequest: AbortController | undefined;
    private requestedUpdatedAt = 0;
    private refreshAfterRequest = false;
    private discountCodeRequest: AbortController | undefined;
    private initialSeedConsumed = false;
    private completionGeneration = -1;
    private completionTimer: ReturnType<typeof setTimeout> | undefined;
    private readonly collectors = new Map<symbol, InternalCollector>();
    private readonly frames = new Map<symbol, InternalFrameBinding>();
    private readonly validatorTokens = new Map<ValueFieldType, symbol>();
    private paymentSurface: { token: symbol; method?: PaymentMethod } | undefined;
    private readonly submitButtons = new Set<symbol>();
    private setupWordedError: { source: BiasElementsError; worded: BiasElementsError } | undefined;
    private suppressSubmissionTransitions = false;
    private terminalError: BiasElementsError | undefined;
    private discountCodePendingAction: DiscountCodeAction | null = null;
    private discountCodeError: string | null = null;
    private discountCodeSynchronizationFailed = false;
    private readonly optimisticallyRemovedDiscountIds = new Set<string>();

    constructor(config: ElementsConfig) {
        this.config = resolveElementsConfig(config);
        let initial!: BiasStoreState;
        this.store = createBiasStore({
            clientSecret: () => this.config.clientSecret,
            apiBaseUrl: this.config.apiBaseUrl,
            rememberDetails: () => this.config.rememberDetails,
            preview: () => this.config.preview === true,
            onChange: (next) => this.onStoreChange(next),
            onComplete: () => this.complete(),
            onPaymentPending: (attempt, payment, reconcile) =>
                this.resolvePendingPayment(attempt, payment, reconcile),
            refreshCheckoutSession: () => void this.fetchSession(this.generation, true),
            getCheckoutSession: () => this.checkoutSession(),
            updateCheckoutSession: (params, signal) =>
                this.updateCheckoutSessionInternal(params, signal),
        });
        initial = this.store.getState();
        this.storeState = initial;
    }

    getPublicState(): BiasElementsState {
        const session = this.checkoutSession();
        const selection = session ? this.storeState.paymentSelection : undefined;
        const methods = conventionalMethods(session);
        const paymentMethod =
            selection?.kind === "saved"
                ? methods.includes(selection.method.type as PaymentMethod)
                    ? (selection.method.type as PaymentMethod)
                    : undefined
                : selection && methods.includes(selection.method)
                  ? selection.method
                  : undefined;
        const savedPaymentMethod =
            selection?.kind === "saved" && paymentMethod ? selection.method : undefined;
        return {
            sessionState: this.sessionState as unknown as SessionState,
            discountCodeState: {
                pendingAction: this.discountCodePendingAction,
                error: this.discountCodeError,
                blocked: this.discountCodeBlocked(),
                blocksSubmission: this.discountCodeMutationBlocked(),
                optimisticallyRemovedDiscountIds: [...this.optimisticallyRemovedDiscountIds],
            },
            detailsSaveState: this.storeState.detailsSaveState,
            paymentMethod,
            walletAvailability: {
                applePay: walletMethods(session).includes("apple_pay")
                    ? this.walletAvailability.applePay
                    : "unavailable",
            },
            savedPaymentMethods: this.eligibleSavedPaymentMethods(),
            savedPaymentMethod,
            status: this.submissionStatus,
            canSubmit: this.canSubmit(),
            submissionError: this.presentedSubmissionError(session),
        };
    }

    private presentedSubmissionError(session: CheckoutSession | undefined) {
        const error = this.submissionError;
        const message = error && session?.mode === "setup" && setupMessage(error.message);
        if (!error || !message) return error;
        if (this.setupWordedError?.source !== error) {
            this.setupWordedError = {
                source: error,
                worded: elementsError(
                    error.code,
                    message,
                    error.apiErrorType,
                    error.customerMessage,
                ),
            };
        }
        return this.setupWordedError.worded;
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
        this.presentingWallet = undefined;
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
        if (!this.config.clientSecret) {
            this.setTerminalError(elementsError("authentication_failed"));
            return;
        }
        if (this.config.preview) {
            this.applyPreviewSession();
            return;
        }
        if (seed) this.applySession(fromPublicSession(seed));
        this.startEventStream(generation);
        void this.fetchSession(generation);
    }

    /** A preview's session is always the configured one; it is never loaded from the API. */
    private applyPreviewSession() {
        const session = this.config.initialCheckoutSession;
        if (!session) {
            this.setTerminalError(
                elementsError("configuration_error", "preview requires initialCheckoutSession."),
            );
            return;
        }
        if (session.client_secret !== this.config.clientSecret) {
            this.setTerminalError(
                elementsError(
                    "configuration_error",
                    "initialCheckoutSession does not belong to clientSecret.",
                ),
            );
            return;
        }
        this.applySession(fromPublicSession(session));
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.generation++;
        this.presentingWallet = undefined;
        this.walletConfigurationRequest?.abort();
        this.walletConfigurationRequest = undefined;
        this.applePayConfig = undefined;
        this.applePayPresentation = undefined;
        this.applePayPresentationRequest?.abort();
        this.applePayPresentationRequest = undefined;
        this.applePayUpdateQueue = Promise.resolve();
        this.cancelPaymentResolution();
        this.walletPaymentInFlight = undefined;
        this.answeredFailureToken = undefined;
        this.request?.abort();
        this.request = undefined;
        this.cancelCompletion();
        this.eventRequest?.abort();
        this.eventRequest = undefined;
        this.requestedUpdatedAt = 0;
        this.refreshAfterRequest = false;
        this.discountCodeRequest?.abort();
        this.discountCodeRequest = undefined;
        this.resetDiscountCodeState();
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
            previous.apiBaseUrl !== resolvedNext.apiBaseUrl ||
            Boolean(previous.preview) !== Boolean(resolvedNext.preview);
        const frameChanged = previous.frameUrl !== resolvedNext.frameUrl;

        if (
            resolvedNext.initialCheckoutSession !== previous.initialCheckoutSession &&
            !identityChanged
        ) {
            if (resolvedNext.preview) {
                if (this.active) this.applyPreviewSession();
            } else {
                console.warn(
                    "Bias Elements: a later initialCheckoutSession was ignored for the current checkout session.",
                );
            }
        }
        const expandChanged = !structurallyEqual(
            mergeCheckoutSessionExpand(previous.checkoutSessionExpand),
            mergeCheckoutSessionExpand(resolvedNext.checkoutSessionExpand),
        );
        const defaultsChanged = !structurallyEqual(
            previous.defaultValues,
            resolvedNext.defaultValues,
        );
        const rememberedConfigChanged =
            previous.rememberDetails !== resolvedNext.rememberDetails ||
            !structurallyEqual(previous.savedPaymentMethods, resolvedNext.savedPaymentMethods);
        if (
            !identityChanged &&
            !frameChanged &&
            !expandChanged &&
            !defaultsChanged &&
            !rememberedConfigChanged
        ) {
            return;
        }
        if (!identityChanged && !frameChanged && !expandChanged) {
            if (this.active && defaultsChanged) {
                this.store.applyDefaultValues(resolvedNext.defaultValues ?? {});
            }
            if (this.active && rememberedConfigChanged) this.reconcileRememberedSelection();
            this.notify();
            return;
        }

        this.generation++;
        if (identityChanged) {
            this.walletConfigurationRequest?.abort();
            this.walletConfigurationRequest = undefined;
            this.applePayConfig = undefined;
            this.applePayPresentation = undefined;
            this.applePayPresentationRequest?.abort();
            this.applePayPresentationRequest = undefined;
            this.applePayUpdateQueue = Promise.resolve();
        }
        this.request?.abort();
        this.request = undefined;
        this.cancelCompletion();
        if (identityChanged) {
            this.eventRequest?.abort();
            this.eventRequest = undefined;
            this.requestedUpdatedAt = 0;
            this.refreshAfterRequest = false;
        }
        this.discountCodeRequest?.abort();
        this.discountCodeRequest = undefined;
        // Cancelling an attempt does not cancel a payment request it already dispatched,
        // so that request is resolved with its idempotency key. A payment the API already
        // refused keeps its real error instead of becoming an unknown outcome.
        const keepsAttempt =
            !identityChanged &&
            (frameChanged || expandChanged) &&
            (this.submissionStatus === "submitting" || this.submissionStatus === "processing");
        const dispatched = keepsAttempt
            ? (this.store.takeDispatchedPayment() ?? this.takeWalletPaymentInFlight())
            : undefined;
        const answeredFailure =
            keepsAttempt && !dispatched ? this.store.takeAnsweredPaymentFailure() : undefined;
        const holdsSubmission =
            keepsAttempt &&
            (dispatched !== undefined ||
                answeredFailure !== undefined ||
                this.paymentResolution !== undefined ||
                this.answeredFailureToken !== undefined);
        this.store.cancel();
        if (!holdsSubmission) {
            this.submissionStatus = "idle";
            this.submissionError = null;
            this.presentingWallet = undefined;
            this.applePayPresentation = undefined;
            this.applePayPresentationRequest?.abort();
            this.applePayPresentationRequest = undefined;
            this.applePayUpdateQueue = Promise.resolve();
            this.cancelPaymentResolution();
            this.walletPaymentInFlight = undefined;
            this.answeredFailureToken = undefined;
        }
        this.completionGeneration = -1;

        if (identityChanged) {
            this.terminalError = undefined;
            this.sessionState = this.active ? { status: "loading" } : { status: "idle" };
            this.paymentSelectionTouched = false;
            this.walletAvailability = { applePay: "loading" };
            this.store.setApiBaseUrl(resolvedNext.apiBaseUrl);
            this.store.resetSessionFields();
            this.resetDiscountCodeState();
        } else {
            this.suppressSubmissionTransitions = holdsSubmission;
            this.store.resetFrameFields();
            this.suppressSubmissionTransitions = false;
        }
        if (this.active && dispatched) this.resolvePaymentAttempt(dispatched);
        if (this.active && answeredFailure) this.awaitAnsweredFailure(answeredFailure);
        this.notify();
        if (this.active && identityChanged) {
            if (!this.config.clientSecret) {
                this.setTerminalError(elementsError("authentication_failed"));
            } else if (this.config.preview) {
                this.applyPreviewSession();
            } else {
                this.startEventStream(this.generation);
                void this.fetchSession(this.generation);
            }
        }
        if (this.active && !identityChanged && expandChanged)
            void this.fetchSession(this.generation);
        if (this.active && !identityChanged && defaultsChanged) {
            this.store.applyDefaultValues(resolvedNext.defaultValues ?? {});
        }
        if (this.active && !identityChanged && rememberedConfigChanged) {
            this.reconcileRememberedSelection();
        }
    }

    refreshSession() {
        if (!this.active) {
            warnInactive("refreshSession");
            return;
        }
        if (this.submissionLocked() || this.discountCodeMutationBlocked()) return;
        void this.fetchSession(this.generation);
    }

    updateCheckoutSession(
        params: ShopperCheckoutSessionUpdateParams,
    ): Promise<PublicCheckoutSession> {
        if (this.submissionLocked()) {
            return Promise.reject(elementsError("session_update_failed"));
        }
        // Store-owned autosave/submission writes call the internal path directly so
        // details already authorized by the shopper can settle during submission.
        return this.updateCheckoutSessionInternal(params).then(toPublicSession);
    }

    applyDiscountCode(
        code: string,
        synchronize?: (session: PublicCheckoutSession) => void | Promise<void>,
    ): Promise<boolean> {
        const value = code.trim();
        if (!value) return Promise.resolve(false);
        return this.mutateDiscountCode(
            "apply",
            (sdk, signal) =>
                sdk.checkoutSessions.discountCode.apply(
                    "current",
                    { code: value, expand: this.mergedExpand() } as never,
                    { signal },
                ),
            synchronize,
        );
    }

    removeDiscountCode(
        discountId: string,
        synchronize?: (session: PublicCheckoutSession) => void | Promise<void>,
    ): Promise<boolean> {
        if (!discountId) return Promise.resolve(false);
        if (!this.active) {
            warnInactive("removeDiscountCode");
            return Promise.resolve(false);
        }
        if (this.discountCodeBlocked()) return Promise.resolve(false);
        this.optimisticallyRemovedDiscountIds.add(discountId);
        return this.mutateDiscountCode(
            "remove",
            (sdk, signal) =>
                sdk.checkoutSessions.discountCode.remove(
                    "current",
                    discountId,
                    { expand: this.mergedExpand() } as never,
                    { signal },
                ),
            synchronize,
        ).finally(() => {
            this.optimisticallyRemovedDiscountIds.delete(discountId);
            this.notify();
        });
    }

    clearDiscountCodeError(): void {
        if (!this.discountCodeError || this.discountCodeSynchronizationFailed) return;
        this.discountCodeError = null;
        this.notify();
    }

    retryDetailsSave() {
        if (!this.active) {
            warnInactive("retryDetailsSave");
            return;
        }
        if (this.submissionLocked()) return;
        this.store.retryDetailsSave();
    }

    setPaymentMethod(method: PaymentMethod) {
        if (!this.active) {
            warnInactive("setPaymentMethod");
            return;
        }
        if (this.submissionLocked()) return;
        if (!conventionalMethods(this.checkoutSession()).includes(method)) {
            console.warn(
                `Bias Elements: payment method "${method}" is not enabled for this session.`,
            );
            return;
        }
        this.paymentSelectionTouched = true;
        const selection = this.storeState.paymentSelection;
        if (selection.kind === "new" && selection.method === method) return;
        this.store.setSelectedPaymentMethod(method);
        this.clearFailedSubmission();
        this.notify();
    }

    setSavedPaymentMethod(id: string) {
        if (!this.active) {
            warnInactive("setSavedPaymentMethod");
            return;
        }
        if (this.submissionLocked()) return;
        const method = this.eligibleSavedPaymentMethods().find((candidate) => candidate.id === id);
        if (!method) {
            console.warn(
                `Bias Elements: saved payment method "${id}" is not available for this session.`,
            );
            return;
        }
        this.paymentSelectionTouched = true;
        const selection = this.storeState.paymentSelection;
        if (selection.kind === "saved" && selection.method.id === method.id) return;
        this.store.setSelectedSavedPaymentMethod(method);
        this.clearFailedSubmission();
        this.notify();
    }

    setWalletAvailability(method: WalletPaymentMethod, status: WalletAvailabilityStatus) {
        if (method !== "apple_pay" || this.walletAvailability.applePay === status) return;
        this.walletAvailability = { applePay: status };
        this.notify();
    }

    beginWalletPresentation(method: WalletPaymentMethod): boolean {
        if (!this.active) {
            warnInactive("beginWalletPresentation");
            return false;
        }
        if (
            this.submissionLocked() ||
            this.discountCodeMutationBlocked() ||
            !this.store.isDetailsSaveReady() ||
            this.sessionState.status !== "ready" ||
            !walletMethods(this.checkoutSession()).includes(method) ||
            this.getPublicState().walletAvailability.applePay !== "available"
        ) {
            return false;
        }
        this.presentingWallet = method;
        this.submissionStatus = "presenting_wallet";
        this.submissionError = null;
        this.notify();
        return true;
    }

    cancelWalletPresentation(method: WalletPaymentMethod) {
        if (this.submissionStatus !== "presenting_wallet" || this.presentingWallet !== method)
            return;
        this.presentingWallet = undefined;
        if (method === "apple_pay") {
            this.applePayPresentation = undefined;
            this.applePayPresentationRequest?.abort();
            this.applePayPresentationRequest = undefined;
            this.applePayUpdateQueue = Promise.resolve();
        }
        this.submissionStatus = "idle";
        this.submissionError = null;
        this.notify();
    }

    async prepareApplePay(signal?: AbortSignal): Promise<ApplePayWalletConfig | null> {
        if (
            !this.active ||
            this.config.preview ||
            !walletMethods(this.checkoutSession()).includes("apple_pay")
        )
            return null;
        const owner = {
            generation: this.generation,
            clientSecret: this.config.clientSecret,
            apiBaseUrl: this.config.apiBaseUrl,
        };
        this.walletConfigurationRequest?.abort();
        this.applePayConfig = undefined;
        const request = new AbortController();
        this.walletConfigurationRequest = request;
        const requestSignal = signal ? AbortSignal.any([request.signal, signal]) : request.signal;
        try {
            const sdk = new Bias({ apiKey: owner.clientSecret, baseURL: owner.apiBaseUrl });
            const result = await sdk.checkout.wallets.configuration(undefined, {
                signal: requestSignal,
            });
            if (
                !this.owns(owner) ||
                requestSignal.aborted ||
                ("object" in result && result.object === "error")
            )
                return null;
            if (!("apple_pay" in result)) return null;
            const config = result.apple_pay;
            const session = this.checkoutSession();
            if (
                !config?.enabled ||
                !session ||
                config.currency_code.toUpperCase() !==
                    sessionCurrency(session, config.currency_code).toUpperCase()
            ) {
                this.applePayConfig = undefined;
                return null;
            }
            this.applePayConfig = config;
            return config;
        } catch {
            return null;
        } finally {
            if (this.walletConfigurationRequest === request)
                this.walletConfigurationRequest = undefined;
        }
    }

    beginApplePayPresentation(): ApplePayPresentation | null {
        const session = this.checkoutSession();
        const config = this.applePayConfig;
        if (!session || !config || !this.beginWalletPresentation("apple_pay")) return null;
        const amount = applePayPayableAmount(session);
        if (amount <= 0) {
            this.cancelWalletPresentation("apple_pay");
            return null;
        }
        const presentation: ApplePayPresentation = {
            config,
            checkoutSessionId: session.id,
            updatedAt: session.updated_at,
            amount,
            currency: sessionCurrency(session, config.currency_code),
            requiresBillingContact: Boolean(session.billing_details_collection),
            requiresEmail: true,
            requiresPhone: [...this.collectors.values()].some((collector) =>
                collector.kind === "contact"
                    ? collector.fields.includes("phone")
                    : collector.scope === "shipping" && collector.fields.includes("shippingPhone"),
            ),
            requiresShippingContact: Boolean(session.shipping_address_collection),
            shippingMethods: applePayShippingMethods(session),
            selectedShippingRate: selectedApplePayShippingRate(session),
        };
        this.applePayPresentationRequest?.abort();
        this.applePayPresentationRequest = new AbortController();
        this.applePayUpdateQueue = Promise.resolve();
        this.applePayPresentation = presentation;
        return presentation;
    }

    async validateApplePayMerchant(
        presentation: ApplePayPresentation,
        validationUrl: string,
        signal?: AbortSignal,
    ): Promise<Record<string, unknown>> {
        if (!this.applePayPresentationIsCurrent(presentation))
            throw elementsError("payment_failed");
        const sdk = new Bias({ apiKey: this.config.clientSecret, baseURL: this.config.apiBaseUrl });
        const result = await sdk.checkout.wallets.applePay.merchantSession(
            { validation_url: validationUrl },
            { signal },
        );
        if (!this.applePayPresentationIsCurrent(presentation) || signal?.aborted)
            throw elementsError("payment_failed");
        if ("object" in result && result.object === "error")
            throw elementsError("payment_failed", shopperErrorMessage(result.error));
        return result as Record<string, unknown>;
    }

    updateApplePayShippingContact(
        presentation: ApplePayPresentation,
        shippingContact: ApplePayContact,
        signal?: AbortSignal,
    ): Promise<ApplePayPresentationUpdate> {
        return this.enqueueApplePayPresentationUpdate(
            presentation,
            { shipping_contact: applePayContactForWire(shippingContact) },
            signal,
        );
    }

    updateApplePayShippingMethod(
        presentation: ApplePayPresentation,
        shippingRate: string,
        signal?: AbortSignal,
    ): Promise<ApplePayPresentationUpdate> {
        return this.enqueueApplePayPresentationUpdate(
            presentation,
            { shipping_rate: shippingRate },
            signal,
        );
    }

    private enqueueApplePayPresentationUpdate(
        presentation: ApplePayPresentation,
        params: ApplePayUpdateInputSource,
        signal?: AbortSignal,
    ): Promise<ApplePayPresentationUpdate> {
        const presentationRequest = this.applePayPresentationRequest;
        if (!presentationRequest || !this.applePayPresentationIsOwned(presentation))
            return Promise.reject(elementsError("payment_failed"));
        const requestSignal = signal
            ? AbortSignal.any([presentationRequest.signal, signal])
            : presentationRequest.signal;
        const update = this.applePayUpdateQueue.then(() => {
            if (requestSignal.aborted || this.applePayPresentation !== presentation)
                throw elementsError("payment_failed");
            const updateParams = typeof params === "function" ? params() : params;
            if (!updateParams) {
                if (!this.applePayPresentationIsCurrent(presentation))
                    throw elementsError("payment_failed");
                return {
                    amount: presentation.amount,
                    shippingMethods: presentation.shippingMethods,
                };
            }
            return this.updateApplePayPresentation(presentation, updateParams, requestSignal);
        });
        this.applePayUpdateQueue = update.then(
            () => undefined,
            () => undefined,
        );
        return update;
    }

    private async updateApplePayPresentation(
        presentation: ApplePayPresentation,
        params: ApplePayUpdateInput,
        signal?: AbortSignal,
    ): Promise<ApplePayPresentationUpdate> {
        if (!this.applePayPresentationIsCurrent(presentation))
            throw elementsError("payment_failed");
        const expectedUpdatedAt = presentation.updatedAt;
        const expectedAmount = presentation.amount;
        const owner = {
            generation: this.generation,
            clientSecret: this.config.clientSecret,
            apiBaseUrl: this.config.apiBaseUrl,
        };
        try {
            const sdk = new Bias({ apiKey: owner.clientSecret, baseURL: owner.apiBaseUrl });
            const result = await sdk.checkout.wallets.applePay.update(
                {
                    checkout_session_updated_at: expectedUpdatedAt,
                    ...params,
                },
                { signal },
            );
            if (isApiError(result)) throw result;
            const session = result as CheckoutSession;
            if (
                !this.owns(owner) ||
                signal?.aborted ||
                this.applePayPresentation !== presentation ||
                this.presentingWallet !== "apple_pay" ||
                presentation.updatedAt !== expectedUpdatedAt ||
                session.id !== presentation.checkoutSessionId ||
                session.client_secret !== owner.clientSecret
            ) {
                throw elementsError("payment_failed");
            }
            const amount = applePayPayableAmount(session);
            if (amount <= 0) throw elementsError("payment_failed");
            const currency = sessionCurrency(session, presentation.config.currency_code);
            if (currency.toUpperCase() !== presentation.currency.toUpperCase())
                throw elementsError("payment_failed");

            if (params.final && amount !== expectedAmount) {
                this.applySession(session);
                this.failStaleApplePayPresentation();
                throw elementsError("payment_failed", CHECKOUT_TOTALS_CHANGED_MESSAGE);
            }

            presentation.updatedAt = session.updated_at;
            presentation.amount = amount;
            presentation.shippingMethods = applePayShippingMethods(session);
            presentation.selectedShippingRate = selectedApplePayShippingRate(session);
            this.applySession(session);
            return { amount, shippingMethods: presentation.shippingMethods };
        } catch (cause) {
            if (isCheckoutTotalsChanged(cause) && this.applePayPresentation === presentation) {
                this.failStaleApplePayPresentation();
            }
            throw cause;
        }
    }

    async authorizeApplePay(
        presentation: ApplePayPresentation,
        paymentData: ApplePayPaymentData,
        billingContact?: ApplePayContact,
        shippingContact?: ApplePayContact,
        signal?: AbortSignal,
    ): Promise<ApplePayAuthorizationResult> {
        if (!this.applePayPresentationIsOwned(presentation)) {
            this.failStaleApplePayPresentation();
            return "failure";
        }
        this.submissionStatus = "submitting";
        this.submissionError = null;
        this.notify();
        const owner = {
            generation: this.generation,
            clientSecret: this.config.clientSecret,
            apiBaseUrl: this.config.apiBaseUrl,
        };
        let paymentStarted = false;
        let attempt: PaymentAttempt | undefined;
        try {
            await this.enqueueApplePayPresentationUpdate(
                presentation,
                () => {
                    const selectedShippingRate = presentation.selectedShippingRate;
                    if (
                        !presentation.requiresShippingContact &&
                        !shippingContact &&
                        !billingContact &&
                        !selectedShippingRate
                    ) {
                        return null;
                    }
                    return {
                        final: true,
                        ...(shippingContact
                            ? { shipping_contact: applePayContactForWire(shippingContact) }
                            : {}),
                        ...(billingContact
                            ? { billing_contact: applePayContactForWire(billingContact) }
                            : {}),
                        ...(selectedShippingRate ? { shipping_rate: selectedShippingRate } : {}),
                    };
                },
                signal,
            );
            if (!this.applePayPresentationIsCurrent(presentation)) {
                this.failStaleApplePayPresentation();
                return "failure";
            }
            const sdk = new Bias({ apiKey: owner.clientSecret, baseURL: owner.apiBaseUrl });
            const session = this.checkoutSession();
            if (!session) {
                this.failStaleApplePayPresentation();
                return "failure";
            }
            const billingDetails = mergeApplePayBillingDetails(session, billingContact);
            attempt = {
                method: "apple_pay",
                idempotencyKey: createIdempotencyKey(),
                params: {
                    amount: presentation.amount,
                    checkout_session_updated_at: presentation.updatedAt,
                    remember: false,
                    payment_method: {
                        apple_pay: { payment_data: paymentData },
                        ...(billingDetails ? { billing_details: billingDetails } : {}),
                    },
                },
                sentAmount: presentation.amount,
                knownPaymentIds: sessionPaymentIds(session),
            };
            paymentStarted = true;
            this.walletPaymentInFlight = attempt;
            let result: Awaited<ReturnType<Bias["payments"]["create"]>>;
            try {
                result = await sdk.payments.create(attempt.params, {
                    signal,
                    idempotencyKey: attempt.idempotencyKey,
                });
            } finally {
                if (this.walletPaymentInFlight === attempt) this.walletPaymentInFlight = undefined;
            }
            // A frame or expansion change may have handed this request to resolution.
            if (this.paymentResolution?.attempt === attempt) return "ambiguous";
            if (!this.owns(owner)) return "failure";
            if (result.object === "error") {
                const meaning = classifyIdempotencyError(result.error);
                if (meaning === "retry" || meaning === "reconcile") {
                    this.resolvePaymentAttempt(attempt, undefined, meaning === "reconcile");
                    return "ambiguous";
                }
                if (meaning === "mismatch") {
                    this.failApplePayPresentation(PAYMENT_UNCONFIRMED_MESSAGE);
                } else if (isCheckoutTotalsChanged(result)) {
                    this.failStaleApplePayPresentation();
                } else {
                    this.failApplePayPresentation(shopperErrorMessage(result.error));
                }
                return "failure";
            }
            const outcome = classifyPaymentStatus(result.status, "apple_pay");
            if (outcome === "failed") {
                this.failApplePayPresentation(failedPaymentMessage(result));
                return "failure";
            }
            if (outcome === "pending") {
                this.resolvePaymentAttempt(attempt, result);
                return "ambiguous";
            }
            this.presentingWallet = undefined;
            this.applePayPresentation = undefined;
            this.applePayPresentationRequest?.abort();
            this.applePayPresentationRequest = undefined;
            this.applePayUpdateQueue = Promise.resolve();
            this.submissionStatus = "succeeded";
            this.submissionError = null;
            this.notify();
            void this.fetchSession(this.generation, true);
            this.complete();
            return "success";
        } catch (cause) {
            if (attempt && this.paymentResolution?.attempt === attempt) return "ambiguous";
            if (!this.owns(owner)) return "failure";
            if (isCheckoutTotalsChanged(cause)) {
                this.failStaleApplePayPresentation();
                return "failure";
            }
            if (this.applePayPresentation !== presentation || this.presentingWallet !== "apple_pay")
                return "failure";
            if (
                cause &&
                typeof cause === "object" &&
                "object" in cause &&
                cause.object === "error" &&
                "error" in cause
            ) {
                this.failApplePayPresentation(shopperErrorMessage((cause as ApiError).error));
                return "failure";
            }
            if (!paymentStarted || !attempt) {
                this.failApplePayPresentation(
                    "Apple Pay details could not be updated. Please try again.",
                );
                return "failure";
            }
            // The payment request threw after dispatch, so it may still have charged.
            this.resolvePaymentAttempt(attempt);
            return "ambiguous";
        }
    }

    private failStaleApplePayPresentation() {
        this.failApplePayPresentation(CHECKOUT_TOTALS_CHANGED_MESSAGE);
        this.applePayConfig = undefined;
        this.setWalletAvailability("apple_pay", "loading");
        const generation = this.generation;
        void this.refreshApplePayAfterStaleFailure(generation);
    }

    private async refreshApplePayAfterStaleFailure(generation: number) {
        await this.fetchSession(generation, true);
        if (!this.active || generation !== this.generation) return;
        const config = await this.prepareApplePay();
        if (!this.active || generation !== this.generation) return;
        this.setWalletAvailability("apple_pay", config ? "available" : "unavailable");
    }

    failApplePayPresentation(message?: string): void {
        if (this.presentingWallet !== "apple_pay" || this.paymentResolution) return;
        this.presentingWallet = undefined;
        this.applePayPresentation = undefined;
        this.applePayPresentationRequest?.abort();
        this.applePayPresentationRequest = undefined;
        this.applePayUpdateQueue = Promise.resolve();
        this.submissionStatus = "failed";
        this.submissionError = elementsError("payment_failed", message);
        this.notify();
    }

    clearRememberedDetails() {
        if (!this.active) {
            warnInactive("clearRememberedDetails");
            return;
        }
        if (this.submissionLocked()) return;
        this.store.clearDefaultValues();
        const fallback = conventionalMethods(this.checkoutSession())[0];
        if (fallback) this.store.setSelectedPaymentMethod(fallback);
        this.paymentSelectionTouched = true;
        void this.store.applyGeoDefaults();
        this.clearFailedSubmission();
        this.notify();
    }

    submit() {
        if (!this.active) {
            warnInactive("submit");
            return;
        }
        if (
            this.config.preview ||
            !this.checkoutSession() ||
            !this.selectedConventionalMethod() ||
            this.nothingToCollect() ||
            this.discountCodeMutationBlocked() ||
            this.submissionLocked()
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
                if (this.submissionLocked()) return;
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
        const preview = () => this.config.preview === true;
        const key = () =>
            `${this.config.clientSecret}:${this.config.apiBaseUrl}:${frameUrl()}${preview() ? ":preview" : ""}`;
        const group = this.frameGroup;
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
            get preview() {
                return preview();
            },
            get key() {
                return key();
            },
            group,
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

    getAddressVerification(scope: AddressScope) {
        return this.store.getAddressVerification(scope);
    }

    verifyAddress(scope: AddressScope) {
        if (!this.active) {
            warnInactive("verifyAddress");
            return Promise.resolve(null);
        }
        return this.store.verifyAddress(scope);
    }

    getBillingSameAsShipping(): boolean {
        return this.storeState.billingSameAsShipping;
    }

    setBillingSameAsShipping(value: boolean) {
        if (!this.active) return warnInactive("setBillingSameAsShipping");
        if (this.submissionLocked()) return;
        this.store.setBillingSameAsShipping(value);
    }

    hasCollector(
        kind: "contact" | "address",
        scope?: AddressScope,
        field?: ValueFieldType,
    ): boolean {
        return [...this.collectors.values()].some((collector) => {
            if (field && !(collector.fields as readonly ValueFieldType[]).includes(field))
                return false;
            if (kind === "contact") return collector.kind === "contact";
            return collector.kind === "address" && collector.scope === scope;
        });
    }

    registerCollector(collector: InternalCollector): () => void {
        const token = Symbol(collector.kind);
        this.collectors.set(token, collector);
        if (this.active) {
            this.applyRegistrations();
            const session = this.checkoutSession();
            if (session) {
                this.store.hydrateFromSession(session);
                this.store.applyDefaultValues(this.config.defaultValues ?? {});
            }
        }
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
            !conventionalMethods(this.checkoutSession()).includes(method)
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

    registerSubmitButton(): () => void {
        const token = Symbol("submit-button");
        this.submitButtons.add(token);
        this.notify();
        return () => {
            if (this.submitButtons.delete(token)) this.notify();
        };
    }

    hasSubmitButton(): boolean {
        return this.submitButtons.size > 0;
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

    /** The store sent a conventional payment whose outcome is not yet known. */
    private resolvePendingPayment(
        attempt: PaymentAttempt,
        payment?: ObservedPayment,
        reconcile = false,
    ) {
        if (!this.active || this.submissionStatus !== "submitting") return;
        this.resolvePaymentAttempt(attempt, payment, reconcile);
    }

    /**
     * Resolve a dispatched payment request whose outcome is unknown, keeping submission
     * locked until the outcome is final. The outcome comes only from this attempt's own
     * request (replayed by its idempotency key) or its own payment, never from other
     * payments on the session. After the bounded schedule the attempt is shown as
     * `processing` while resolution continues at a capped delay.
     */
    private resolvePaymentAttempt(
        attempt: PaymentAttempt,
        payment?: ObservedPayment,
        reconcile = false,
    ) {
        this.cancelPaymentResolution();
        this.answeredFailureToken = undefined;
        // A wallet sheet is told the outcome is ambiguous; the presentation is over.
        this.presentingWallet = undefined;
        this.applePayPresentation = undefined;
        this.applePayPresentationRequest?.abort();
        this.applePayPresentationRequest = undefined;
        this.applePayUpdateQueue = Promise.resolve();
        const resolution: PaymentResolution = {
            attempt,
            owner: { clientSecret: this.config.clientSecret, apiBaseUrl: this.config.apiBaseUrl },
            request: new AbortController(),
            paymentId: undefined,
            reconcile,
            retryCount: 0,
            timer: undefined,
        };
        this.paymentResolution = resolution;
        this.submissionStatus = "submitting";
        this.submissionError = null;
        this.notify();
        if (payment) this.observeResolvedPayment(resolution, payment);
        else this.scheduleResolutionStep(resolution);
    }

    private observeResolvedPayment(
        resolution: PaymentResolution,
        payment: ObservedPayment,
        sessionRefreshed = false,
    ) {
        if (this.paymentResolution !== resolution) return;
        const outcome = classifyPaymentStatus(payment.status, resolution.attempt.method);
        if (outcome === "succeeded") {
            this.finishPaymentResolution(resolution, null, sessionRefreshed);
        } else if (outcome === "failed") {
            this.finishPaymentResolution(
                resolution,
                { message: failedPaymentMessage(payment), totalsChanged: false },
                sessionRefreshed,
            );
        } else {
            resolution.paymentId = payment.id;
            this.scheduleResolutionStep(resolution);
        }
    }

    /** Re-send the attempt's identical request so the API answers for the original. */
    private async replayPaymentAttempt(resolution: PaymentResolution) {
        const { attempt, owner } = resolution;
        let result: Awaited<ReturnType<Bias["payments"]["create"]>>;
        try {
            const sdk = new Bias({ apiKey: owner.clientSecret, baseURL: owner.apiBaseUrl });
            result = await sdk.payments.create(attempt.params, {
                signal: resolution.request.signal,
                idempotencyKey: attempt.idempotencyKey,
            });
        } catch {
            this.scheduleResolutionStep(resolution);
            return;
        }
        if (this.paymentResolution !== resolution) return;
        if (result.object !== "error") {
            this.observeResolvedPayment(resolution, result);
            return;
        }
        const meaning = classifyIdempotencyError(result.error);
        if (meaning === "retry") {
            this.scheduleResolutionStep(resolution);
            return;
        }
        if (meaning === "reconcile") {
            // The key will never replay the original: look for its outcome on the session.
            resolution.reconcile = true;
            resolution.retryCount = 0;
            this.scheduleResolutionStep(resolution);
            return;
        }
        if (meaning === "mismatch") {
            this.finishPaymentResolution(resolution, {
                message: PAYMENT_UNCONFIRMED_MESSAGE,
                totalsChanged: false,
            });
            return;
        }
        // The original request's own answer: no payment was created for it.
        const failure = await describePaymentError(result.error, attempt.sentAmount, () =>
            this.currentAmountRemaining(resolution),
        );
        this.finishPaymentResolution(resolution, failure);
    }

    private async currentAmountRemaining(resolution: PaymentResolution) {
        const { owner } = resolution;
        const sdk = new Bias({ apiKey: owner.clientSecret, baseURL: owner.apiBaseUrl });
        const session = await sdk.checkoutSessions.get("current", undefined, {
            signal: resolution.request.signal,
        });
        if (session.object === "error") return undefined;
        return checkoutAmountRemaining(session, resolution.attempt.method);
    }

    private scheduleResolutionStep(resolution: PaymentResolution) {
        if (this.paymentResolution !== resolution || resolution.timer !== undefined) return;
        if (resolution.reconcile && resolution.paymentId === undefined) {
            this.scheduleReconcileStep(resolution);
            return;
        }
        const bounded = PAYMENT_RESOLUTION_RETRY_MS[resolution.retryCount];
        if (bounded === undefined && this.submissionStatus === "submitting") {
            // Still unknown after the bounded schedule (a payment in review, or the API
            // is unreachable): report it as processing instead of an endless spinner.
            this.submissionStatus = "processing";
            this.notify();
        }
        const delay =
            bounded ??
            Math.min(
                PAYMENT_RESOLUTION_RETRY_MS.at(-1)! *
                    2 ** (resolution.retryCount - PAYMENT_RESOLUTION_RETRY_MS.length + 1),
                PAYMENT_RESOLUTION_MAX_RETRY_MS,
            );
        resolution.retryCount++;
        resolution.timer = setTimeout(() => {
            resolution.timer = undefined;
            if (!this.active || this.paymentResolution !== resolution) return;
            if (resolution.paymentId === undefined) void this.replayPaymentAttempt(resolution);
            else void this.fetchSession(this.generation, true);
        }, delay);
    }

    /** Read the session again until it shows the attempt's outcome, or give up as unconfirmed. */
    private scheduleReconcileStep(resolution: PaymentResolution) {
        const delay = PAYMENT_RECONCILE_DELAYS_MS[resolution.retryCount];
        if (delay === undefined) {
            this.finishPaymentResolution(resolution, {
                message: PAYMENT_UNCONFIRMED_MESSAGE,
                totalsChanged: false,
            });
            return;
        }
        if (this.submissionStatus === "submitting") {
            this.submissionStatus = "processing";
            this.notify();
        }
        resolution.retryCount++;
        resolution.timer = setTimeout(() => {
            resolution.timer = undefined;
            if (!this.active || this.paymentResolution !== resolution) return;
            void this.fetchSession(this.generation, true);
        }, delay);
    }

    private finishPaymentResolution(
        resolution: PaymentResolution,
        failure: PaymentFailure | null,
        sessionRefreshed = false,
    ) {
        if (this.paymentResolution !== resolution) return;
        this.cancelPaymentResolution();
        if (failure) {
            this.applyPaymentFailure(failure, resolution.attempt.method);
            return;
        }
        this.submissionStatus = "succeeded";
        this.submissionError = null;
        this.notify();
        if (!sessionRefreshed) void this.fetchSession(this.generation, true);
        this.complete();
    }

    private applyPaymentFailure(failure: PaymentFailure, method: string) {
        this.submissionStatus = "failed";
        this.submissionError = elementsError(
            "payment_failed",
            failure.totalsChanged ? CHECKOUT_TOTALS_CHANGED_MESSAGE : failure.message,
        );
        this.notify();
        if (!failure.totalsChanged) return;
        if (method === "apple_pay") {
            this.applePayConfig = undefined;
            this.setWalletAvailability("apple_pay", "loading");
            void this.refreshApplePayAfterStaleFailure(this.generation);
        } else {
            void this.fetchSession(this.generation, true);
        }
    }

    /** Report a refused payment whose attempt was cancelled while its message was prepared. */
    private awaitAnsweredFailure(failure: Promise<PaymentFailure>) {
        const token = {};
        this.answeredFailureToken = token;
        void failure
            .catch(() => ({ message: PAYMENT_NOT_COMPLETED_MESSAGE, totalsChanged: false }))
            .then((resolved) => {
                if (!this.active || this.answeredFailureToken !== token) return;
                this.answeredFailureToken = undefined;
                this.applyPaymentFailure(resolved, "card");
            });
    }

    private takeWalletPaymentInFlight(): PaymentAttempt | undefined {
        const attempt = this.walletPaymentInFlight;
        this.walletPaymentInFlight = undefined;
        return attempt;
    }

    private cancelPaymentResolution() {
        const resolution = this.paymentResolution;
        if (!resolution) return;
        this.paymentResolution = undefined;
        if (resolution.timer !== undefined) clearTimeout(resolution.timer);
        resolution.timer = undefined;
        resolution.request.abort();
    }

    private applePayPresentationIsOwned(presentation: ApplePayPresentation): boolean {
        return (
            this.active &&
            this.presentingWallet === "apple_pay" &&
            this.applePayPresentation === presentation &&
            this.applePayConfig === presentation.config &&
            this.checkoutSession()?.id === presentation.checkoutSessionId
        );
    }

    private applePayPresentationIsCurrent(presentation: ApplePayPresentation): boolean {
        const session = this.checkoutSession();
        return (
            this.applePayPresentationIsOwned(presentation) &&
            session?.updated_at === presentation.updatedAt &&
            applePayPayableAmount(session) === presentation.amount &&
            sessionCurrency(session, presentation.config.currency_code) === presentation.currency
        );
    }

    private checkoutSession(): CheckoutSession | undefined {
        return "session" in this.sessionState ? this.sessionState.session : undefined;
    }

    private mergedExpand() {
        return mergeCheckoutSessionExpand(this.config.checkoutSessionExpand);
    }

    private submissionLocked(): boolean {
        return (
            this.submissionStatus === "presenting_wallet" ||
            this.submissionStatus === "submitting" ||
            this.submissionStatus === "processing" ||
            this.submissionStatus === "succeeded"
        );
    }

    private selectedConventionalMethod(): PaymentMethod | undefined {
        const session = this.checkoutSession();
        const methods = conventionalMethods(session);
        const selection = this.storeState.paymentSelection;
        if (selection.kind === "new") {
            return methods.includes(selection.method) ? selection.method : undefined;
        }
        return isConventionalMethod(selection.method.type) &&
            methods.includes(selection.method.type)
            ? selection.method.type
            : undefined;
    }

    /**
     * A payment session with nothing left to charge the selected method right now, e.g.
     * while payments elsewhere hold an invoice's balance. Submitting waits for the
     * session to show an amount again.
     */
    private nothingToCollect(): boolean {
        const session = this.checkoutSession();
        const method = this.selectedConventionalMethod();
        return (
            !!session &&
            !!method &&
            session.mode !== "setup" &&
            !subscriptionFreeToday(session) &&
            checkoutAmountRemaining(session, method) <= 0
        );
    }

    private canSubmit(): boolean {
        return (
            this.active &&
            !this.paymentResolution &&
            !this.answeredFailureToken &&
            this.sessionState.status !== "loading" &&
            this.sessionState.status !== "idle" &&
            !!this.selectedConventionalMethod() &&
            !this.nothingToCollect() &&
            !this.submissionLocked() &&
            !this.discountCodeMutationBlocked() &&
            this.store.isDetailsSaveReady() &&
            this.store.isSubmittable()
        );
    }

    private async fetchSession(generation: number, rerunIfBusy = false) {
        if (!this.active || this.config.preview || generation !== this.generation) return;
        if (this.request) {
            if (rerunIfBusy) this.refreshAfterRequest = true;
            return;
        }
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
            const result = await sdk.checkoutSessions.get(
                "current",
                { expand: this.mergedExpand() },
                { signal: request.signal },
            );
            if (!this.owns(owner) || request.signal.aborted) return;
            if (result.object === "error") throw result.error;
            this.applySession(result as CheckoutSession);
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
            const current = this.checkoutSession();
            if (
                this.active &&
                generation === this.generation &&
                current &&
                current.updated_at < this.requestedUpdatedAt
            ) {
                this.refreshAfterRequest = false;
                void this.fetchSession(generation);
            } else if (this.active && generation === this.generation && this.refreshAfterRequest) {
                this.refreshAfterRequest = false;
                void this.fetchSession(generation);
            } else if (current && current.updated_at >= this.requestedUpdatedAt) {
                this.requestedUpdatedAt = 0;
            }
            // Keep following a pending payment, or looking for an unreplayable attempt's
            // outcome, whether or not this refresh succeeded.
            const resolution = this.paymentResolution;
            if (
                resolution &&
                (resolution.paymentId !== undefined || resolution.reconcile) &&
                this.request === undefined
            )
                this.scheduleResolutionStep(resolution);
        }
    }

    private async updateCheckoutSessionInternal(
        params: ShopperCheckoutSessionUpdateParams,
        signal?: AbortSignal,
    ): Promise<CheckoutSession> {
        if (!this.active) throw elementsError("session_update_failed");
        if (this.config.preview) {
            const session = this.checkoutSession();
            if (!session) throw elementsError("session_update_failed");
            return session;
        }
        const owner = {
            generation: this.generation,
            clientSecret: this.config.clientSecret,
            apiBaseUrl: this.config.apiBaseUrl,
        };
        try {
            const sdk = new Bias({ apiKey: owner.clientSecret, baseURL: owner.apiBaseUrl });
            const result = await sdk.checkoutSessions.update(
                "current",
                { ...params, expand: this.mergedExpand() },
                { signal },
            );
            if (!this.owns(owner) || signal?.aborted) throw elementsError("session_update_failed");
            if (isApiError(result)) {
                throw elementsError(
                    "session_update_failed",
                    result.error.message,
                    result.error.type,
                    result.error.customer_message,
                );
            }
            this.applySession(result as CheckoutSession);
            return this.checkoutSession() ?? (result as CheckoutSession);
        } catch (error) {
            if (error && typeof error === "object" && "code" in error) throw error;
            throw elementsError(
                "session_update_failed",
                error instanceof Error ? error.message : undefined,
            );
        }
    }

    private startEventStream(generation: number) {
        this.eventRequest?.abort();
        const request = new AbortController();
        this.eventRequest = request;
        void this.watchEvents(generation, request.signal);
    }

    private async watchEvents(generation: number, signal: AbortSignal) {
        let retryDelay = EVENT_RETRY_INITIAL_MS;
        while (this.active && generation === this.generation && !signal.aborted) {
            try {
                const sdk = new Bias({
                    apiKey: this.config.clientSecret,
                    baseURL: this.config.apiBaseUrl,
                });
                const events = await sdk.events.list(
                    { stream: true, filters: { type: "checkout_session.updated" } },
                    { signal },
                );
                if (!(Symbol.asyncIterator in Object(events)))
                    throw new Error("Event stream failed");
                for await (const event of events as AsyncGenerator<Event>) {
                    if (signal.aborted || generation !== this.generation) return;
                    retryDelay = EVENT_RETRY_INITIAL_MS;
                    this.handleSessionEvent(event);
                }
            } catch {
                if (signal.aborted || generation !== this.generation) return;
            }
            await waitForRetry(retryDelay, signal);
            retryDelay = Math.min(retryDelay * 2, EVENT_RETRY_MAX_MS);
        }
    }

    private handleSessionEvent(event: Event) {
        if (event.type !== "checkout_session.updated" || event.object !== "event") return;
        const state = event.state;
        const current = this.checkoutSession();
        if (
            !current ||
            !state ||
            state.object !== "checkout_session" ||
            state.id !== current.id ||
            state.updated_at <= current.updated_at
        ) {
            return;
        }
        this.requestedUpdatedAt = Math.max(this.requestedUpdatedAt, state.updated_at);
        void this.fetchSession(this.generation);
    }

    private async mutateDiscountCode(
        action: DiscountCodeAction,
        operation: (sdk: Bias, signal: AbortSignal) => Promise<CheckoutSession | ApiError>,
        synchronize?: (session: PublicCheckoutSession) => void | Promise<void>,
    ): Promise<boolean> {
        if (!this.active) {
            warnInactive(`${action}DiscountCode`);
            return false;
        }
        if (this.config.preview || this.discountCodeBlocked()) return false;

        this.discountCodePendingAction = action;
        this.discountCodeError = null;
        this.notify();

        const owner = {
            generation: this.generation,
            clientSecret: this.config.clientSecret,
            apiBaseUrl: this.config.apiBaseUrl,
        };
        const request = new AbortController();
        this.discountCodeRequest = request;
        let mutationSucceeded = false;

        try {
            const sdk = new Bias({ apiKey: owner.clientSecret, baseURL: owner.apiBaseUrl });
            const result = await operation(sdk, request.signal);
            if (!this.owns(owner) || request.signal.aborted) return false;
            if (isApiError(result)) {
                this.discountCodeError = formatDiscountCodeError(result);
                this.notify();
                return false;
            }

            mutationSucceeded = true;
            this.clearFailedSubmission();
            this.applySession(result);
            await synchronize?.(toPublicSession(result));
            return true;
        } catch {
            if (!this.owns(owner) || request.signal.aborted) return false;
            if (mutationSucceeded) {
                this.discountCodeSynchronizationFailed = true;
                this.discountCodeError = `The discount code was ${action === "apply" ? "applied" : "removed"}, but the updated checkout couldn't be loaded. Refresh this page to continue.`;
            } else {
                this.discountCodeError =
                    action === "apply"
                        ? "We couldn't apply this discount code. Please try again."
                        : "We couldn't remove this discount code. Please try again.";
            }
            this.notify();
            return false;
        } finally {
            if (this.discountCodeRequest === request) this.discountCodeRequest = undefined;
            if (this.owns(owner)) {
                this.discountCodePendingAction = null;
                this.notify();
            }
        }
    }

    private discountCodeMutationBlocked(): boolean {
        return this.discountCodePendingAction !== null || this.discountCodeSynchronizationFailed;
    }

    private discountCodeBlocked(): boolean {
        return (
            this.discountCodeMutationBlocked() ||
            this.submissionLocked() ||
            this.sessionState.status !== "ready"
        );
    }

    private resetDiscountCodeState() {
        this.discountCodePendingAction = null;
        this.discountCodeError = null;
        this.discountCodeSynchronizationFailed = false;
        this.optimisticallyRemovedDiscountIds.clear();
    }

    private owns(owner: { generation: number; clientSecret: string; apiBaseUrl: string }) {
        return (
            this.active &&
            this.generation === owner.generation &&
            this.config.clientSecret === owner.clientSecret &&
            this.config.apiBaseUrl === owner.apiBaseUrl
        );
    }

    private eligibleSavedPaymentMethods(
        session = this.checkoutSession(),
    ): readonly SavedPaymentMethod[] {
        if (session?.mode === "setup") return [];
        const methods = conventionalMethods(session);
        return this.config.savedPaymentMethods.filter(
            (method) =>
                method.active && isConventionalMethod(method.type) && methods.includes(method.type),
        );
    }

    private reconcileRememberedSelection() {
        const eligible = this.eligibleSavedPaymentMethods();
        const selection = this.storeState.paymentSelection;
        if (selection.kind === "saved") {
            const current = eligible.find((method) => method.id === selection.method.id);
            if (current) {
                this.store.setSelectedSavedPaymentMethod(current);
                return;
            }
            const fallback = conventionalMethods(this.checkoutSession())[0];
            if (fallback) this.store.setSelectedPaymentMethod(fallback);
            return;
        }
        if (!this.paymentSelectionTouched && eligible[0]) {
            this.store.setSelectedSavedPaymentMethod(eligible[0]);
        }
    }

    private applySession(session: CheckoutSession) {
        const current = this.checkoutSession();
        if (current && session.updated_at < current.updated_at) return;
        const methods = conventionalMethods(session);
        if (sessionMethods(session).length === 0) {
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
        const resolution = this.paymentResolution;
        if (resolution) {
            if (session.status === "complete") {
                // The checkout is paid, so no further payment can be taken for it.
                this.finishPaymentResolution(resolution, null, true);
                return;
            }
            const payment =
                resolution.paymentId === undefined
                    ? resolution.reconcile
                        ? attemptPaymentOnSession(resolution.attempt, session)
                        : undefined
                    : expandedPayments(session).find(({ id }) => id === resolution.paymentId);
            if (payment) this.observeResolvedPayment(resolution, payment, true);
            if (this.paymentResolution === resolution) {
                this.notify();
                return;
            }
            if (this.submissionStatus === "succeeded") return;
        }
        const selection = this.storeState.paymentSelection;
        const eligibleSaved = this.eligibleSavedPaymentMethods(session);
        const currentSaved =
            selection.kind === "saved"
                ? eligibleSaved.find((method) => method.id === selection.method.id)
                : undefined;
        const initialSaved =
            !fixedMethod && !this.paymentSelectionTouched ? eligibleSaved[0] : undefined;
        const nextSaved = currentSaved ?? initialSaved;
        const currentMethod = selection.kind === "new" ? selection.method : undefined;
        const nextMethod =
            fixedMethod ??
            (nextSaved && isConventionalMethod(nextSaved.type) ? nextSaved.type : undefined) ??
            (currentMethod && methods.includes(currentMethod) ? currentMethod : methods[0]);
        if (!fixedMethod && nextSaved) this.store.setSelectedSavedPaymentMethod(nextSaved);
        else if (nextMethod) this.store.setSelectedPaymentMethod(nextMethod);
        this.store.hydrateFromSession(session);
        this.store.applyDefaultValues(this.config.defaultValues ?? {});
        void this.store.applyGeoDefaults();
        this.notify();
    }

    private setTerminalError(error: BiasElementsError) {
        this.terminalError = error;
        this.sessionState = { status: "error", error };
        this.notify();
    }

    private onStoreChange(next: BiasStoreState) {
        const previousStoreState = this.storeState;
        const fieldEdited = this.relevantFieldChanged(this.storeState, next);
        this.storeState = next;
        if (
            this.suppressSubmissionTransitions ||
            this.paymentResolution ||
            this.answeredFailureToken ||
            this.presentingWallet ||
            this.walletPaymentInFlight
        ) {
            this.notify();
            return;
        }
        if (next.submitSuccess) {
            this.submissionStatus = "succeeded";
            this.submissionError = null;
            if (!previousStoreState.submitSuccess) {
                void this.fetchSession(this.generation, true);
            }
        } else if (this.submissionStatus === "submitting" && !next.submitLoading) {
            if (next.paymentError) {
                this.submissionStatus = "failed";
                this.submissionError = elementsError("payment_failed", next.paymentError);
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
        const generation = this.generation;
        this.completionGeneration = generation;
        this.completionTimer = setTimeout(() => {
            this.completionTimer = undefined;
            if (
                !this.active ||
                this.generation !== generation ||
                this.submissionStatus !== "succeeded"
            )
                return;
            try {
                this.config.onComplete?.();
            } catch {
                // Consumer callback failures cannot change controller state or replay completion.
            }
        }, COMPLETION_DELAY_MS);
    }

    private cancelCompletion() {
        if (this.completionTimer !== undefined) clearTimeout(this.completionTimer);
        this.completionTimer = undefined;
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
        const contactFields = [...this.collectors.values()].flatMap((collector) =>
            collector.kind === "contact" ? collector.fields : [],
        );
        this.store.setContactDetailsFields(
            contactFields.length ? [...new Set(contactFields)] : null,
        );
    }
}

export type { ElementsConfig as BiasControllerConfig } from "./adapter";
