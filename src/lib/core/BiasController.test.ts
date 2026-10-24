import type { CheckoutSession } from "@biaspay/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BiasController } from "./BiasController";
import { detectGeoLocation } from "./geo";

vi.mock("./geo", () => ({ detectGeoLocation: vi.fn(async () => undefined) }));

const sdk = vi.hoisted(() => ({
    get: vi.fn(),
    update: vi.fn(),
    createPayment: vi.fn(),
    walletConfiguration: vi.fn(),
    merchantSession: vi.fn(),
    applePayUpdate: vi.fn(),
    validateAddress: vi.fn(),

    applyDiscountCode: vi.fn(),
    removeDiscountCode: vi.fn(),
    listEvents: vi.fn(),
    calls: [] as Array<Record<string, unknown>>,
}));
vi.mock("@biaspay/sdk-checkout", () => ({
    Bias: class {
        checkoutSessions = {
            get: (...args: unknown[]) => sdk.get(...args),
            update: (...args: unknown[]) => sdk.update(...args),
            discountCode: {
                apply: (...args: unknown[]) => sdk.applyDiscountCode(...args),
                remove: (...args: unknown[]) => sdk.removeDiscountCode(...args),
            },
        };
        payments = { create: (...args: unknown[]) => sdk.createPayment(...args) };
        checkout = {
            address: { validate: (...args: unknown[]) => sdk.validateAddress(...args) },
            wallets: {
                configuration: (...args: unknown[]) => sdk.walletConfiguration(...args),
                applePay: {
                    merchantSession: (...args: unknown[]) => sdk.merchantSession(...args),
                    update: (...args: unknown[]) => sdk.applePayUpdate(...args),
                },
            },
        };

        events = { list: (...args: unknown[]) => sdk.listEvents(...args) };
        constructor(options: Record<string, unknown>) {
            sdk.calls.push(options);
        }
    },
}));

function session(overrides: Partial<CheckoutSession> = {}): CheckoutSession {
    return {
        object: "checkout_session",
        id: "cs_test",
        updated_at: 1,
        client_secret: "cs_1",
        payment_method_types: ["card", "us_bank_account"],
        customer_details: { email: null, name: null, phone: null },
        shipping_details: null,
        billing_details: null,
        payments: null,
        mode: "payment",
        total: 5_000,
        amount_collected: 0,
        amount_remaining: 5_000,
        dual_pricing: null,
        ...overrides,
    } as CheckoutSession;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Replaces the session event stream with one the test pushes events into. */
function controlSessionEvents() {
    const queue: unknown[] = [];
    let wake: (() => void) | undefined;
    sdk.listEvents.mockImplementation(
        async (_params: unknown, request: { signal: AbortSignal }) => ({
            async *[Symbol.asyncIterator]() {
                while (!request.signal.aborted) {
                    const next = queue.shift();
                    if (next !== undefined) {
                        yield next as never;
                        continue;
                    }
                    await new Promise<void>((resolve) => {
                        wake = resolve;
                        request.signal.addEventListener("abort", () => resolve(), { once: true });
                    });
                }
            },
        }),
    );
    return (event: unknown) => {
        queue.push(event);
        wake?.();
    };
}

/** The API's answer while the original request with the same key is still running. */
const IDEMPOTENCY_IN_USE = {
    object: "error",
    error: {
        type: "idempotency_error",
        code: "idempotency_key_in_use",
        message:
            "Idempotency key 'elements_1' already in use in request 'req_1'. Wait for the previous request to finish before retrying.",
    },
};

/** The API's answer once the original request with the same key can never be replayed. */
const IDEMPOTENCY_OUTCOME_UNKNOWN = {
    object: "error",
    error: {
        type: "idempotency_error",
        code: "idempotency_outcome_unknown",
        message:
            "Request 'req_1' exceeded its processing lease and its outcome is unknown. Idempotency key 'elements_1' remains reserved to prevent duplicate side effects.",
    },
};

/** Every call re-sends the first call's exact body with the first call's idempotency key. */
function expectIdenticalReplays(calls: unknown[][]) {
    const [params, config] = calls[0] as [unknown, { idempotencyKey?: unknown }];
    expect(config.idempotencyKey).toEqual(expect.any(String));
    expect(calls.length).toBeGreaterThan(1);
    for (const [replayParams, replayConfig] of calls.slice(1) as [
        unknown,
        { idempotencyKey?: unknown },
    ][]) {
        expect(JSON.stringify(replayParams)).toBe(JSON.stringify(params));
        expect(replayConfig.idempotencyKey).toBe(config.idempotencyKey);
    }
}

beforeEach(() => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: false, status: 503 })),
    );
    sdk.calls.length = 0;
    sdk.get.mockReset().mockResolvedValue(session());
    sdk.update.mockReset().mockResolvedValue({ object: "checkout_session" });
    sdk.createPayment
        .mockReset()
        .mockResolvedValue({ object: "payment", id: "pay_test", status: "succeeded" });
    sdk.walletConfiguration.mockReset().mockResolvedValue({
        apple_pay: {
            enabled: true,
            country_code: "US",
            currency_code: "USD",
            supported_networks: ["visa", "masterCard"],
            merchant_capabilities: ["supports3DS"],
            display_name: "Bias Test",
        },
    });
    sdk.validateAddress.mockReset().mockResolvedValue({});
    sdk.merchantSession.mockReset().mockResolvedValue({ merchantSessionIdentifier: "merchant" });
    sdk.applePayUpdate.mockReset().mockResolvedValue({
        object: "error",
        error: { type: "api_error", message: "wallet update not mocked" },
    });

    sdk.applyDiscountCode.mockReset().mockResolvedValue(session());
    sdk.removeDiscountCode.mockReset().mockResolvedValue(session());
    sdk.listEvents
        .mockReset()
        .mockImplementation(async (_params: unknown, request: { signal: AbortSignal }) => ({
            async *[Symbol.asyncIterator]() {
                await new Promise<void>((resolve) => {
                    if (request.signal.aborted) resolve();
                    else request.signal.addEventListener("abort", () => resolve(), { once: true });
                });
                if (!request.signal.aborted) yield {} as never;
            },
        }));
});

describe("BiasController adapter contract", () => {
    it("is inactive until activated and supports restartable generations", async () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        expect(controller.getPublicState()).toMatchObject({
            sessionState: { status: "idle" },
            paymentMethod: undefined,
            status: "idle",
        });
        controller.activate();
        controller.activate();
        await flush();
        expect(sdk.get).toHaveBeenCalledTimes(1);
        expect(sdk.get).toHaveBeenCalledWith(
            "current",
            { expand: { discounts: true, payments: true } },
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
        expect(controller.getPublicState().paymentMethod).toBe("card");

        controller.deactivate();
        controller.deactivate();
        controller.activate();
        await flush();
        expect(sdk.get).toHaveBeenCalledTimes(2);
    });

    it("does not apply a stale response after deactivation", async () => {
        let resolve!: (value: CheckoutSession) => void;
        sdk.get.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
        const controller = new BiasController({ clientSecret: "cs_1" });
        const listener = vi.fn();
        controller.subscribe(listener);
        controller.activate();
        controller.deactivate();
        listener.mockClear();
        resolve(session());
        await flush();
        expect(listener).not.toHaveBeenCalled();
    });

    it("atomically replaces session ownership when identity config changes", async () => {
        sdk.get
            .mockResolvedValueOnce(session())
            .mockResolvedValueOnce(
                session({ client_secret: "cs_2", payment_method_types: ["us_bank_account"] }),
            );
        const controller = new BiasController({ clientSecret: "cs_1", apiBaseUrl: "https://a" });
        controller.activate();
        await flush();
        controller.updateConfig({ clientSecret: "cs_2", apiBaseUrl: "https://b" });
        expect(controller.getPublicState()).toMatchObject({
            sessionState: { status: "loading" },
            paymentMethod: undefined,
            status: "idle",
        });
        await flush();
        expect(controller.getPublicState().paymentMethod).toBe("us_bank_account");
        expect(sdk.calls.at(-1)).toEqual({ apiKey: "cs_2", baseURL: "https://b" });
    });

    it("validates configuration before exposing a session", () => {
        const controller = new BiasController({ clientSecret: "" });
        controller.activate();
        expect(controller.getPublicState().sessionState).toMatchObject({
            status: "error",
            error: { code: "authentication_failed", retryable: false },
        });
        expect(controller.getPublicState().paymentMethod).toBeUndefined();
        expect(sdk.get).not.toHaveBeenCalled();
    });

    it("exposes an initial checkout session while refreshing it", () => {
        sdk.get.mockImplementationOnce(() => new Promise(() => {}));
        const initialCheckoutSession = session({ payment_method_types: ["us_bank_account"] });
        const controller = new BiasController({ clientSecret: "cs_1", initialCheckoutSession });

        controller.activate();

        expect(controller.getPublicState()).toMatchObject({
            sessionState: { status: "refreshing", session: initialCheckoutSession },
            paymentMethod: "us_bank_account",
        });
    });

    it("normalizes terminal and recoverable refresh errors", async () => {
        sdk.get.mockRejectedValueOnce({ status: 401 }).mockRejectedValueOnce(new Error("secret"));
        const terminal = new BiasController({ clientSecret: "cs_1" });
        terminal.activate();
        await flush();
        expect(terminal.getPublicState().sessionState).toMatchObject({
            status: "error",
            error: { code: "authentication_failed", retryable: false },
        });

        sdk.get
            .mockReset()
            .mockResolvedValueOnce(session())
            .mockRejectedValueOnce(new Error("secret"));
        const seeded = new BiasController({ clientSecret: "cs_1" });
        seeded.activate();
        await flush();
        await flush();
        seeded.refreshSession();
        await flush();
        expect(seeded.getPublicState().sessionState).toMatchObject({
            status: "error",
            session: expect.any(Object),
            error: { code: "session_load_failed", retryable: true },
        });
    });

    it("enforces one payment surface and releases it deterministically", () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        const unregister = controller.registerPaymentElement("card");
        expect(() => controller.registerPaymentElement()).toThrowError(
            expect.objectContaining({ code: "configuration_error" }),
        );
        unregister();
        expect(() => controller.registerPaymentElement("us_bank_account")).not.toThrow();
    });

    it("reference-counts disposable collectors", () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        const a = controller.registerCollector({ kind: "contact", fields: ["email"] });
        const b = controller.registerCollector({ kind: "contact", fields: ["email"] });
        controller.activate();
        a();
        controller.getField("email").setValue("person@example.com");
        expect(controller.getField("email").state.value).toBe("person@example.com");
        b();
    });

    it("loads normalized address metadata for an arbitrary country", async () => {
        let resolveFetch!: (value: object) => void;
        const fetchMock = vi.fn(
            () =>
                new Promise((resolve) => {
                    resolveFetch = resolve;
                }),
        );
        vi.stubGlobal("fetch", fetchMock);
        const controller = new BiasController({ clientSecret: "cs_1" });
        const listener = vi.fn();
        controller.subscribe(listener);
        controller.activate();

        expect(controller.getAddressMetadataForCountry(" nz ")).toMatchObject({
            status: "loading",
            metadata: { country: "NZ" },
        });
        expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/NZ$/));

        resolveFetch({
            ok: true,
            json: async () => ({ fmt: "%N%n%A%n%C%n%Z", require: "ACZ" }),
        });
        await flush();
        expect(controller.getAddressMetadataForCountry("NZ")).toMatchObject({
            status: "ready",
            metadata: { country: "NZ" },
        });
        expect(listener).toHaveBeenCalled();
        vi.unstubAllGlobals();
    });

    it("uses authoritative metadata fallback and does not notify after cleanup", async () => {
        let rejectFetch!: (reason: Error) => void;
        vi.stubGlobal(
            "fetch",
            vi.fn(
                () =>
                    new Promise((_resolve, reject) => {
                        rejectFetch = reject;
                    }),
            ),
        );
        const controller = new BiasController({ clientSecret: "cs_1" });
        const listener = vi.fn();
        controller.subscribe(listener);
        controller.activate();
        listener.mockClear();

        expect(controller.getAddressMetadataForCountry("QZ").status).toBe("loading");
        controller.deactivate();
        rejectFetch(new Error("offline"));
        await flush();
        expect(controller.getAddressMetadataForCountry("qz")).toMatchObject({
            status: "fallback",
            metadata: { country: "QZ" },
        });
        expect(listener).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });

    it("rejects duplicate validators and uses token-safe cleanup", () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        const field = controller.getField("postalCode");
        const cleanup = field.setValidator(() => ({ isValid: true, error: null }));
        expect(() => field.setValidator(() => ({ isValid: false, error: "bad" }))).toThrowError(
            expect.objectContaining({ code: "configuration_error" }),
        );
        cleanup();
        expect(() => field.setValidator(() => ({ isValid: true, error: null }))).not.toThrow();
    });

    it("validates a host field without changing its focus ownership", () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        const field = controller.getField("postalCode");
        field.setValidator((value) => ({ isValid: value === "valid", error: "invalid" }));
        field.onFocus();
        field.setValue("bad");
        field.validate();
        expect(field.state).toMatchObject({ isFocused: true, isValid: false, error: "invalid" });
    });

    it("accepts an Apple-Pay-only session without exposing a conventional selection", async () => {
        sdk.get.mockResolvedValue(session({ payment_method_types: ["apple_pay"] }));
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();

        expect(controller.getPublicState()).toMatchObject({
            sessionState: { status: "ready" },
            paymentMethod: undefined,
            walletAvailability: { applePay: "loading" },
            status: "idle",
            canSubmit: false,
        });

        controller.submit();
        expect(controller.getPublicState().status).toBe("idle");
        expect(sdk.createPayment).not.toHaveBeenCalled();
        controller.deactivate();
    });

    it("keeps conventional method selection unchanged when Apple Pay is also enabled", async () => {
        sdk.get.mockResolvedValue(
            session({ payment_method_types: ["apple_pay", "card", "us_bank_account"] }),
        );
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();

        expect(controller.getPublicState()).toMatchObject({
            paymentMethod: "card",
            walletAvailability: { applePay: "loading" },
        });
        controller.setPaymentMethod("us_bank_account");
        expect(controller.getPublicState().paymentMethod).toBe("us_bank_account");
        controller.deactivate();
    });

    it("locks conventional submission and mutations while presenting a wallet", async () => {
        sdk.get.mockResolvedValue(
            session({ payment_method_types: ["card", "us_bank_account", "apple_pay"] }),
        );
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        controller.getField("postalCode").setValue("94110");
        for (const field of ["cardNumber", "cardExpiry", "cardCvc"] as const) {
            controller.getFrame(field).setEncryptedData("enc");
        }
        expect(controller.getPublicState().canSubmit).toBe(true);

        controller.setWalletAvailability("apple_pay", "available");
        expect(controller.beginWalletPresentation("apple_pay")).toBe(true);
        expect(controller.getPublicState()).toMatchObject({
            status: "presenting_wallet",
            canSubmit: false,
            paymentMethod: "card",
            walletAvailability: { applePay: "available" },
        });

        controller.setPaymentMethod("us_bank_account");
        controller.getField("postalCode").setValue("10001");
        await expect(
            controller.updateCheckoutSession({ customer_details: { email: "other@example.com" } }),
        ).rejects.toMatchObject({ code: "session_update_failed", retryable: true });
        controller.submit();
        expect(controller.getPublicState()).toMatchObject({
            status: "presenting_wallet",
            paymentMethod: "card",
        });
        expect(controller.getField("postalCode").state.value).toBe("94110");
        expect(sdk.update).not.toHaveBeenCalled();
        expect(sdk.createPayment).not.toHaveBeenCalled();

        controller.cancelWalletPresentation("apple_pay");
        expect(controller.getPublicState()).toMatchObject({ status: "idle", canSubmit: true });
        controller.deactivate();
    });

    it("keeps the API error type on a failed details save", async () => {
        sdk.update.mockResolvedValue({
            object: "error",
            error: { type: "server_error", message: "Internal server error" },
        });
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.registerCollector({ kind: "contact", fields: ["email"] });
        controller.activate();
        await flush();

        controller.getField("email").setValue("shopper@example.com");
        await vi.waitFor(() =>
            expect(controller.getPublicState().detailsSaveState).toMatchObject({
                status: "error",
                error: { code: "session_update_failed", apiErrorType: "server_error" },
            }),
        );
        controller.deactivate();
    });

    it("does not present a wallet while checkout details are pending save", async () => {
        sdk.get.mockResolvedValue(session({ payment_method_types: ["card", "apple_pay"] }));
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.registerCollector({ kind: "contact", fields: ["email"] });
        controller.activate();
        await flush();

        controller.getField("email").setValue("shopper@example.com");
        expect(controller.getPublicState().detailsSaveState.status).toBe("dirty");
        controller.setWalletAvailability("apple_pay", "available");

        expect(controller.beginWalletPresentation("apple_pay")).toBe(false);
        expect(controller.getPublicState()).toMatchObject({
            status: "idle",
            walletAvailability: { applePay: "available" },
        });
        controller.deactivate();
    });

    it("rejects unsupported payment methods with a warning", async () => {
        sdk.get.mockResolvedValue(session({ payment_method_types: ["card"] }));
        const controller = new BiasController({ clientSecret: "cs_1" });
        const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
        controller.activate();
        await flush();
        controller.setPaymentMethod("us_bank_account");
        expect(controller.getPublicState().paymentMethod).toBe("card");
        expect(warning).toHaveBeenCalledWith(expect.stringContaining("not enabled"));
        warning.mockRestore();
    });

    it("deduplicates concurrent refreshes", async () => {
        let resolve!: (value: CheckoutSession) => void;
        sdk.get.mockImplementation(() => new Promise((r) => (resolve = r)));
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        controller.refreshSession();
        controller.refreshSession();
        expect(sdk.get).toHaveBeenCalledTimes(1);
        resolve(session());
        await flush();
    });

    it("ignores old events and coalesces a burst behind one active refresh", async () => {
        sdk.get.mockResolvedValueOnce(session({ updated_at: 10 }));
        const emit = controlSessionEvents();
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();

        let resolveRefresh!: (value: CheckoutSession) => void;
        sdk.get
            .mockImplementationOnce(() => new Promise((resolve) => (resolveRefresh = resolve)))
            .mockResolvedValueOnce(
                session({ updated_at: 30, total: 3_000, amount_remaining: 3_000 }),
            );
        const event = (updatedAt: number, id = "cs_test") =>
            ({
                object: "event",
                type: "checkout_session.updated",
                state: session({ id, updated_at: updatedAt }),
            }) as any;

        emit(event(10));
        emit(event(20, "cs_other"));
        await flush();
        expect(sdk.get).toHaveBeenCalledTimes(1);

        emit(event(20));
        emit(event(30));
        await flush();
        expect(sdk.get).toHaveBeenCalledTimes(2);
        resolveRefresh(session({ updated_at: 15, total: 1_500, amount_remaining: 1_500 }));
        await flush();
        await flush();

        expect(sdk.get).toHaveBeenCalledTimes(3);
        expect(controller.getPublicState().sessionState).toMatchObject({
            session: { updated_at: 30, total: 3_000 },
        });
        controller.deactivate();
    });

    it("never replaces canonical state with an older manual refresh", async () => {
        sdk.get
            .mockResolvedValueOnce(
                session({ updated_at: 20, total: 2_000, amount_remaining: 2_000 }),
            )
            .mockResolvedValueOnce(
                session({ updated_at: 19, total: 1_900, amount_remaining: 1_900 }),
            );
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        controller.refreshSession();
        await flush();
        expect(controller.getPublicState().sessionState).toMatchObject({
            session: { updated_at: 20, total: 2_000 },
        });
        controller.deactivate();
    });

    it("injects merged expansion into checkout updates and applies the canonical response", async () => {
        const updated = session({
            updated_at: 2,
            shipping_details: { name: "Ada", phone: null, address: {} } as any,
        });
        sdk.update.mockResolvedValueOnce(updated);
        const controller = new BiasController({
            clientSecret: "cs_1",
            checkoutSessionExpand: { line_items: { price: true } },
        });
        controller.activate();
        await flush();

        await expect(
            controller.updateCheckoutSession({ shipping_details: { name: "Ada" } }),
        ).resolves.toBe(updated);
        expect(sdk.update).toHaveBeenCalledWith(
            "current",
            {
                shipping_details: { name: "Ada" },
                expand: {
                    line_items: { price: true },
                    discounts: true,
                    payments: true,
                },
            },
            { signal: undefined },
        );
        expect(controller.getPublicState().sessionState).toMatchObject({
            session: { updated_at: 2, shipping_details: { name: "Ada" } },
        });
    });

    it("preserves the API message when a checkout update fails", async () => {
        sdk.update.mockResolvedValueOnce({
            object: "error",
            error: {
                type: "invalid_request_error",
                live: false,
                code: "invalid_parameters",
                message: "That shipping rate is no longer available.",
                param: "shipping_rate",
            },
        });
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();

        await expect(
            controller.updateCheckoutSession({ shipping_rate: "shr_old" }),
        ).rejects.toMatchObject({
            code: "session_update_failed",
            message: "That shipping rate is no longer available.",
        });
    });

    it("batches restored details registered after hydration into one canonical save", async () => {
        sdk.get.mockResolvedValueOnce(
            session({ customer_details: { email: "server@example.com", name: null, phone: null } }),
        );
        sdk.update.mockResolvedValueOnce(
            session({
                updated_at: 2,
                customer_details: {
                    email: "server@example.com",
                    name: "Ada Lovelace",
                    phone: null,
                },
                shipping_details: {
                    name: "Ada Lovelace",
                    phone: null,
                    address: {
                        line1: "12 St James's Square",
                        line2: null,
                        city: "London",
                        state: "London",
                        postal_code: "SW1Y 4LB",
                        country: "GB",
                    },
                },
            }),
        );
        const controller = new BiasController({
            clientSecret: "cs_1",
            defaultValues: {
                email: "saved@example.com",
                shippingFirstName: "Ada",
                shippingLastName: "Lovelace",
                shippingAddressLine1: "12 St James's Square",
                shippingCity: "London",
                shippingState: "London",
                shippingPostalCode: "SW1Y 4LB",
                shippingCountry: "GB",
            },
        });
        controller.activate();
        await flush();
        controller.registerCollector({ kind: "contact", fields: ["email"] });
        controller.registerCollector({
            kind: "address",
            scope: "shipping",
            fields: [
                "firstName",
                "lastName",
                "addressLine1",
                "city",
                "state",
                "postalCode",
                "country",
            ],
        });
        await new Promise((resolve) => setTimeout(resolve, 450));

        expect(sdk.update).toHaveBeenCalledTimes(1);
        expect(sdk.update).toHaveBeenCalledWith(
            "current",
            expect.objectContaining({
                customer_details: expect.objectContaining({ email: "server@example.com" }),
                shipping_details: expect.objectContaining({
                    name: "Ada Lovelace",
                    address: expect.objectContaining({ country: "GB" }),
                }),
                expand: { discounts: true, payments: true },
            }),
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
        expect(controller.getField("email").state).toMatchObject({
            value: "server@example.com",
            error: null,
        });
        controller.deactivate();
    });

    it("selects the first eligible saved method and submits its ID with remember consent", async () => {
        const saved = {
            object: "payment_method",
            id: "pm_saved",
            live: false,
            created_at: 1,
            active: true,
            type: "card",
            card: { last4: "4242", brand: "visa", exp_month: 12, exp_year: 2030 },
            us_bank_account: null,
        } as any;
        const controller = new BiasController({
            clientSecret: "cs_1",
            apiBaseUrl: "/api",
            rememberDetails: true,
            savedPaymentMethods: [saved],
        });
        controller.activate();
        await flush();

        expect(controller.getPublicState()).toMatchObject({
            paymentMethod: "card",
            savedPaymentMethod: { id: "pm_saved" },
        });
        controller.submit();
        await flush();

        expect(sdk.createPayment).toHaveBeenCalledWith(
            {
                payment_method: "pm_saved",
                remember: true,
                amount: 5_000,
                checkout_session_updated_at: 1,
            },
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
        expect(sdk.calls).toContainEqual(expect.objectContaining({ baseURL: "/api" }));
        controller.deactivate();
    });

    it("submits remember false directly from local consent", async () => {
        const saved = {
            object: "payment_method",
            id: "pm_saved",
            live: false,
            created_at: 1,
            active: true,
            type: "card",
            card: null,
            us_bank_account: null,
        } as any;
        const controller = new BiasController({
            clientSecret: "cs_1",
            rememberDetails: false,
            savedPaymentMethods: [saved],
        });
        controller.activate();
        await flush();

        controller.submit();
        await flush();

        expect(sdk.createPayment).toHaveBeenCalledWith(
            {
                payment_method: "pm_saved",
                remember: false,
                amount: 5_000,
                checkout_session_updated_at: 1,
            },
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
        controller.deactivate();
    });

    it("does not require the hidden billing collector when a saved method is selected", async () => {
        const saved = {
            object: "payment_method",
            id: "pm_saved",
            live: false,
            created_at: 1,
            active: true,
            type: "card",
            card: null,
            us_bank_account: null,
        } as any;
        const controller = new BiasController({
            clientSecret: "cs_1",
            savedPaymentMethods: [saved],
        });
        controller.activate();
        await flush();
        controller.registerCollector({
            kind: "address",
            scope: "billing",
            fields: ["firstName", "lastName", "addressLine1", "city", "state", "postalCode"],
        });

        expect(controller.getPublicState()).toMatchObject({
            savedPaymentMethod: { id: "pm_saved" },
            canSubmit: true,
        });
        controller.deactivate();
    });

    it("updates remember consent without resetting secure fields", async () => {
        const controller = new BiasController({ clientSecret: "cs_1", rememberDetails: false });
        controller.activate();
        await flush();
        controller.getFrame("cardNumber").setEncryptedData("encrypted");

        controller.updateConfig({ clientSecret: "cs_1", rememberDetails: true });

        expect(controller.getFrame("cardNumber").state.valid).toBe(true);
        controller.deactivate();
    });

    it("offers no saved methods in a setup session", async () => {
        sdk.get.mockResolvedValue(session({ mode: "setup" } as Partial<CheckoutSession>));
        const controller = new BiasController({
            clientSecret: "cs_1",
            savedPaymentMethods: [
                {
                    object: "payment_method",
                    id: "pm_saved",
                    live: false,
                    created_at: 1,
                    active: true,
                    type: "card",
                    card: null,
                    us_bank_account: null,
                } as any,
            ],
        });
        controller.activate();
        await flush();

        expect(controller.getPublicState()).toMatchObject({
            paymentMethod: "card",
            savedPaymentMethods: [],
            savedPaymentMethod: undefined,
        });
        controller.deactivate();
    });

    it("does not let a late saved-method config overwrite an explicit selection", async () => {
        const controller = new BiasController({ clientSecret: "cs_1", savedPaymentMethods: [] });
        controller.activate();
        await flush();
        controller.setPaymentMethod("us_bank_account");
        controller.updateConfig({
            clientSecret: "cs_1",
            savedPaymentMethods: [
                {
                    object: "payment_method",
                    id: "pm_late",
                    live: false,
                    created_at: 1,
                    active: true,
                    type: "card",
                    card: null,
                    us_bank_account: null,
                } as any,
            ],
        });

        expect(controller.getPublicState()).toMatchObject({
            paymentMethod: "us_bank_account",
            savedPaymentMethod: undefined,
        });
        controller.deactivate();
    });

    it("clears only restored defaults while preserving server fields and shopper edits", async () => {
        sdk.get.mockResolvedValueOnce(
            session({ customer_details: { email: "server@example.com", name: null, phone: null } }),
        );
        const controller = new BiasController({
            clientSecret: "cs_1",
            defaultValues: {
                email: "remembered@example.com",
                shippingCity: "Remembered City",
                shippingPostalCode: "10001",
            },
        });
        controller.activate();
        await flush();
        controller.registerCollector({ kind: "contact", fields: ["email"] });
        controller.registerCollector({
            kind: "address",
            scope: "shipping",
            fields: ["city", "postalCode"],
        });
        controller.getField("shippingPostalCode").setValue("edited");

        controller.clearRememberedDetails();

        expect(controller.getField("email").state.value).toBe("server@example.com");
        expect(controller.getField("shippingCity").state.value).toBe("");
        expect(controller.getField("shippingPostalCode").state.value).toBe("edited");
        expect(controller.getPublicState().savedPaymentMethod).toBeUndefined();
        controller.deactivate();
    });

    it("applies a discount code to the owned session and awaits host synchronization", async () => {
        const updated = session({ total: 4_000, amount_remaining: 4_000 });
        let resolveSynchronization!: () => void;
        sdk.applyDiscountCode.mockResolvedValueOnce(updated);
        const synchronize = vi.fn(
            () => new Promise<void>((resolve) => (resolveSynchronization = resolve)),
        );
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();

        const applying = controller.applyDiscountCode("  SAVE20  ", synchronize);
        await Promise.resolve();
        expect(sdk.applyDiscountCode).toHaveBeenCalledWith(
            "current",
            { code: "SAVE20", expand: { discounts: true, payments: true } },
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
        expect(controller.getPublicState()).toMatchObject({
            discountCodeState: { pendingAction: "apply", blocked: true, error: null },
            canSubmit: false,
            sessionState: { session: { total: 4_000 } },
        });
        expect(synchronize).toHaveBeenCalledWith(updated);

        resolveSynchronization();
        await expect(applying).resolves.toBe(true);
        expect(controller.getPublicState().discountCodeState).toMatchObject({
            pendingAction: null,
            blocked: false,
            error: null,
        });
    });

    it("prevents overlapping discount-code mutations", async () => {
        let resolveApplication!: (session: CheckoutSession) => void;
        sdk.applyDiscountCode.mockImplementationOnce(
            () => new Promise<CheckoutSession>((resolve) => (resolveApplication = resolve)),
        );
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();

        const first = controller.applyDiscountCode("SAVE20");
        await expect(controller.applyDiscountCode("ANOTHER")).resolves.toBe(false);
        await expect(controller.removeDiscountCode("di_1")).resolves.toBe(false);
        expect(sdk.applyDiscountCode).toHaveBeenCalledTimes(1);
        expect(sdk.removeDiscountCode).not.toHaveBeenCalled();

        resolveApplication(session());
        await expect(first).resolves.toBe(true);
    });

    it("presents discount-code API errors without replacing the session", async () => {
        sdk.applyDiscountCode.mockResolvedValueOnce({
            object: "error",
            error: {
                type: "invalid_request_error",
                live: false,
                code: "minimum_not_met",
                message: "This discount code requires a minimum subtotal of 2500 cents.",
                customer_message: "This discount code requires a minimum subtotal of $25.00.",
                param: null,
            },
        });
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();

        await expect(controller.applyDiscountCode("SAVE20")).resolves.toBe(false);
        expect(controller.getPublicState().discountCodeState).toMatchObject({
            pendingAction: null,
            blocked: false,
            error: "This discount code requires a minimum subtotal of $25.00.",
        });
    });

    it("shows the API's customer message when a discount code is not applicable", async () => {
        sdk.applyDiscountCode.mockResolvedValueOnce({
            object: "error",
            error: {
                type: "invalid_request_error",
                live: false,
                code: "invalid_code",
                message: "Code 'SAVE20' fails the order eligibility check.",
                customer_message:
                    "This discount code is valid, but cannot be applied to this order.",
                param: "code",
            },
        });
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();

        await expect(controller.applyDiscountCode("SAVE20")).resolves.toBe(false);
        expect(controller.getPublicState().discountCodeState.error).toBe(
            "This discount code is valid, but cannot be applied to this order.",
        );
    });

    it("words a discount-code failure without a customer message generically", async () => {
        sdk.applyDiscountCode.mockResolvedValueOnce({
            object: "error",
            error: {
                type: "invalid_request_error",
                live: false,
                code: "resource_immutable",
                message: "Session 'cs_1' can't change while a payment is in progress.",
                customer_message: null,
                param: null,
            },
        });
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();

        await controller.applyDiscountCode("SAVE20");
        expect(controller.getPublicState().discountCodeState.error).toBe(
            "This discount code couldn't be applied.",
        );
    });

    it("clears a recoverable discount-code error when the shopper edits the input", async () => {
        sdk.applyDiscountCode.mockResolvedValueOnce({
            object: "error",
            error: {
                type: "invalid_request_error",
                live: false,
                code: "expired",
                message: "server detail",
                customer_message: "This discount code has expired.",
                param: "code",
            },
        });
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();

        await controller.applyDiscountCode("OLD");
        expect(controller.getPublicState().discountCodeState.error).toBe(
            "This discount code has expired.",
        );
        controller.clearDiscountCodeError();
        expect(controller.getPublicState().discountCodeState.error).toBeNull();
    });

    it("optimistically hides a removed code and blocks after host synchronization fails", async () => {
        let resolveRemoval!: (session: CheckoutSession) => void;
        sdk.removeDiscountCode.mockImplementationOnce(
            () => new Promise<CheckoutSession>((resolve) => (resolveRemoval = resolve)),
        );
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();

        const removing = controller.removeDiscountCode("di_1", async () => {
            throw new Error("expanded checkout refresh failed");
        });
        expect(
            controller.getPublicState().discountCodeState.optimisticallyRemovedDiscountIds,
        ).toEqual(["di_1"]);
        await expect(controller.removeDiscountCode("di_2")).resolves.toBe(false);
        expect(
            controller.getPublicState().discountCodeState.optimisticallyRemovedDiscountIds,
        ).toEqual(["di_1"]);
        resolveRemoval(session({ total: 4_000, amount_remaining: 4_000 }));

        await expect(removing).resolves.toBe(false);
        expect(controller.getPublicState().discountCodeState).toMatchObject({
            pendingAction: null,
            blocked: true,
            optimisticallyRemovedDiscountIds: [],
            error: expect.stringContaining("was removed"),
        });
    });

    it("ignores a stale response after config identity changes", async () => {
        let resolveOld!: (value: CheckoutSession) => void;
        sdk.get
            .mockImplementationOnce(() => new Promise((r) => (resolveOld = r)))
            .mockResolvedValueOnce(
                session({ client_secret: "cs_2", payment_method_types: ["us_bank_account"] }),
            );
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        controller.updateConfig({ clientSecret: "cs_2" });
        await flush();
        resolveOld(session({ payment_method_types: ["card"] }));
        await flush();
        expect(controller.getPublicState().paymentMethod).toBe("us_bank_account");
    });

    it("does not refetch for structurally equal expansion config", async () => {
        const controller = new BiasController({
            clientSecret: "cs_1",
            checkoutSessionExpand: { line_items: { price: true } },
        });
        controller.activate();
        await flush();
        controller.updateConfig({
            clientSecret: "cs_1",
            checkoutSessionExpand: { line_items: { price: true } },
        });
        await flush();
        expect(sdk.get).toHaveBeenCalledTimes(1);
    });

    it("reports no supported runtime methods as a terminal configuration error", async () => {
        sdk.get.mockResolvedValue(session({ payment_method_types: ["wire"] as any }));
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        expect(controller.getPublicState().sessionState).toMatchObject({
            status: "error",
            error: { code: "configuration_error" },
        });
    });

    it("stores duplicate-surface failures in public terminal state", () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        controller.registerPaymentElement();
        expect(() => controller.registerPaymentElement("card")).toThrow();
        expect(controller.getPublicState().sessionState).toMatchObject({
            status: "error",
            error: { code: "configuration_error" },
        });
    });

    it("stores unsupported standalone-surface failures in public terminal state", async () => {
        sdk.get.mockResolvedValue(session({ payment_method_types: ["card"] }));
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        expect(() => controller.registerPaymentElement("us_bank_account")).toThrow();
        expect(controller.getPublicState().sessionState).toMatchObject({ status: "error" });
    });

    it("returns a validation-only submission to idle", async () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        controller.submit();
        expect(controller.getPublicState()).toMatchObject({
            status: "idle",
            submissionError: null,
        });
    });

    it("freezes value setters while submission is in flight", async () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        controller.getField("postalCode").setValue("94110");
        for (const field of ["cardNumber", "cardExpiry", "cardCvc"] as const) {
            controller.getFrame(field).setEncryptedData("enc");
        }
        let resolvePaymentSession!: (value: CheckoutSession) => void;
        sdk.get.mockImplementationOnce(() => new Promise((r) => (resolvePaymentSession = r)));
        controller.submit();
        await flush();
        controller.getField("postalCode").setValue("10001");
        expect(controller.getField("postalCode").state.value).toBe("94110");
        resolvePaymentSession(session());
        await flush();
    });

    it("surfaces the decline reason from a failed card payment", async () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        controller.getField("postalCode").setValue("94110");
        for (const field of ["cardNumber", "cardExpiry", "cardCvc"] as const) {
            controller.getFrame(field).setEncryptedData("enc");
        }
        sdk.createPayment.mockResolvedValueOnce({
            object: "error",
            error: {
                type: "payment_error",
                message: "Your card was declined.",
                customer_message: "Your card was declined.",
            },
        });
        controller.submit();
        await vi.waitFor(() =>
            expect(controller.getPublicState()).toMatchObject({
                status: "failed",
                submissionError: { code: "payment_failed", message: "Your card was declined." },
            }),
        );
        controller.deactivate();
    });

    it("words a generic failure for saving a payment method, and keeps decline reasons as they are", async () => {
        sdk.get.mockResolvedValue(session({ mode: "setup" } as Partial<CheckoutSession>));
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        controller.getField("postalCode").setValue("94110");
        for (const field of ["cardNumber", "cardExpiry", "cardCvc"] as const) {
            controller.getFrame(field).setEncryptedData("enc");
        }
        sdk.createPayment.mockResolvedValueOnce({
            object: "error",
            error: { type: "server_error", message: "A server error has occurred." },
        });
        controller.submit();
        await vi.waitFor(() =>
            expect(controller.getPublicState()).toMatchObject({
                status: "failed",
                submissionError: {
                    code: "payment_failed",
                    message: "Your payment method could not be saved.",
                },
            }),
        );
        expect(controller.getPublicState().submissionError).toBe(
            controller.getPublicState().submissionError,
        );

        sdk.createPayment.mockResolvedValueOnce({
            object: "error",
            error: {
                type: "payment_error",
                message: "Your card was declined.",
                customer_message: "Your card was declined.",
            },
        });
        controller.submit();
        await vi.waitFor(() =>
            expect(controller.getPublicState().submissionError?.message).toBe(
                "Your card was declined.",
            ),
        );
        controller.deactivate();
    });

    it("resets encrypted frame values when frame identity changes", async () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        controller.getFrame("cardNumber").setEncryptedData("enc");
        expect(controller.getFrame("cardNumber").state.valid).toBe(true);
        controller.updateConfig({ clientSecret: "cs_1", frameUrl: "https://other.example" });
        expect(controller.getFrame("cardNumber").state.valid).toBe(false);
    });

    it("resolves a payment sent before a frame change by replaying its idempotency key", async () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        fillCard(controller);
        sdk.createPayment
            .mockImplementationOnce(() => new Promise(() => {}))
            .mockResolvedValueOnce(IDEMPOTENCY_IN_USE)
            .mockResolvedValueOnce({
                object: "error",
                error: {
                    type: "payment_error",
                    message: "Your card was declined.",
                    customer_message: "Your card was declined.",
                },
            });
        controller.submit();
        await flush();
        controller.updateConfig({ clientSecret: "cs_1", frameUrl: "https://other.example" });
        expect(controller.getPublicState()).toMatchObject({
            status: "submitting",
            canSubmit: false,
        });
        // The original request still holds the key, so its outcome is not known yet.
        await vi.waitFor(() => expect(sdk.createPayment).toHaveBeenCalledTimes(2));
        await flush();
        expect(controller.getPublicState()).toMatchObject({
            status: "submitting",
            canSubmit: false,
        });
        await vi.waitFor(() =>
            expect(controller.getPublicState()).toMatchObject({
                status: "failed",
                submissionError: { code: "payment_failed", message: "Your card was declined." },
            }),
        );
        expect(sdk.createPayment).toHaveBeenCalledTimes(3);
        expectIdenticalReplays(sdk.createPayment.mock.calls);
        controller.deactivate();
    });

    it("completes a payment sent before a frame change once its replay succeeds", async () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        fillCard(controller);
        sdk.createPayment
            .mockImplementationOnce(() => new Promise(() => {}))
            .mockResolvedValueOnce({ object: "payment", id: "pay_new", status: "succeeded" });
        controller.submit();
        await flush();
        controller.updateConfig({ clientSecret: "cs_1", frameUrl: "https://other.example" });
        await vi.waitFor(() => expect(controller.getPublicState().status).toBe("succeeded"));
        expect(sdk.createPayment).toHaveBeenCalledTimes(2);
        expectIdenticalReplays(sdk.createPayment.mock.calls);
        controller.deactivate();
    });

    function fillCard(controller: BiasController) {
        controller.getField("postalCode").setValue("94110");
        for (const field of ["cardNumber", "cardExpiry", "cardCvc"] as const) {
            controller.getFrame(field).setEncryptedData("enc");
        }
    }

    it("pins a card payment to the displayed payable amount and session version", async () => {
        sdk.get.mockResolvedValue(
            session({
                updated_at: 7,
                total: 5_000,
                amount_remaining: 4000,
                amount_collected: 1_000,
                dual_pricing: { rate: 3, amount_remaining: 4_150 },
            } as any),
        );
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        fillCard(controller);
        controller.submit();
        await vi.waitFor(() => expect(sdk.createPayment).toHaveBeenCalledOnce());
        expect(sdk.createPayment.mock.calls[0]![0]).toMatchObject({
            amount: 4_150,
            checkout_session_updated_at: 7,
        });
        controller.deactivate();
    });

    it("pins the amount shown at submit when a reprice lands during address verification", async () => {
        const billingAddress = {
            line1: "123 Main St",
            line2: null,
            city: "San Francisco",
            state: "CA",
            postal_code: "94110",
            country: "US",
        } as const;
        const displayed = session({
            updated_at: 7,
            total: 4_000,
            amount_remaining: 4_000,
            customer_details: { email: null, name: "Jane Doe", phone: null },
            billing_details: { name: "Jane Doe", address: billingAddress },
        } as any);
        const repriced = session({
            ...displayed,
            updated_at: 8,
            total: 10_000,
            amount_remaining: 10_000,
        } as any);
        sdk.get.mockResolvedValue(displayed);
        sdk.update.mockResolvedValue(displayed);
        const emit = controlSessionEvents();
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        controller.registerCollector({
            kind: "address",
            scope: "billing",
            fields: [
                "firstName",
                "lastName",
                "addressLine1",
                "city",
                "state",
                "postalCode",
                "country",
            ],
        });
        controller.getField("firstName").setValue("Jane");
        controller.getField("lastName").setValue("Doe");
        controller.getField("country").setValue("US");
        controller.getField("addressLine1").setValue(billingAddress.line1);
        controller.getField("city").setValue(billingAddress.city);
        controller.getField("state").setValue(billingAddress.state);
        fillCard(controller);
        await new Promise((resolve) => setTimeout(resolve, 450));

        let releaseVerification!: (value: unknown) => void;
        sdk.validateAddress.mockImplementationOnce(
            () => new Promise((resolve) => (releaseVerification = resolve)),
        );
        void controller.verifyAddress("billing");
        sdk.update.mockReset().mockResolvedValue(repriced);
        controller.submit();
        await flush();

        sdk.get.mockResolvedValue(repriced);
        const fetches = sdk.get.mock.calls.length;
        emit({
            object: "event",
            type: "checkout_session.updated",
            state: repriced,
        });
        await vi.waitFor(() =>
            expect(controller.getPublicState().sessionState).toMatchObject({
                session: { updated_at: 8, amount_remaining: 10_000 },
            }),
        );
        releaseVerification({});

        await vi.waitFor(() =>
            expect(controller.getPublicState().submissionError?.message).toBe(
                "Checkout details changed. Review the updated total and try again.",
            ),
        );
        expect(sdk.createPayment).not.toHaveBeenCalled();
        await vi.waitFor(() => expect(sdk.get.mock.calls.length).toBeGreaterThan(fetches + 1));
        controller.deactivate();
    });

    it("pins a bank payment to the base amount without the card markup", async () => {
        sdk.get.mockResolvedValue(
            session({
                updated_at: 7,
                total: 5_000,
                amount_remaining: 5_000,
                dual_pricing: { rate: 3, amount_remaining: 5_150 },
            } as any),
        );
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        controller.setPaymentMethod("us_bank_account");
        controller.getField("name").setValue("Jane Doe");
        controller.getField("postalCode").setValue("94110");
        controller.getFrame("bankAccountNumber").setEncryptedData("enc");
        controller.getFrame("bankRoutingNumber").setEncryptedData("enc");
        controller.submit();
        await vi.waitFor(() => expect(sdk.createPayment).toHaveBeenCalledOnce());
        expect(sdk.createPayment.mock.calls[0]![0]).toMatchObject({
            amount: 5_000,
            checkout_session_updated_at: 7,
        });
        controller.deactivate();
    });

    it("stops before charging when the submit-time details save changes the total", async () => {
        sdk.get.mockResolvedValue(session({ total: 5_000, amount_remaining: 5_000 } as any));
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        controller.registerCollector({ kind: "contact", fields: ["email"] });
        controller.getField("email").setValue("shopper@example.com");
        fillCard(controller);
        sdk.update.mockResolvedValueOnce(
            session({ updated_at: 2, total: 5_500, amount_remaining: 5_500 } as any),
        );
        controller.submit();
        await vi.waitFor(() =>
            expect(controller.getPublicState()).toMatchObject({
                status: "failed",
                submissionError: {
                    code: "payment_failed",
                    message: "Checkout details changed. Review the updated total and try again.",
                },
            }),
        );
        expect(sdk.createPayment).not.toHaveBeenCalled();
        controller.deactivate();
    });

    it("blocks submission while nothing remains to collect", async () => {
        // Payments elsewhere hold the invoice's balance, so the session shows $0.
        sdk.get.mockResolvedValue(session({ total: 5_000, amount_remaining: 0 } as any));
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        fillCard(controller);
        expect(controller.getPublicState().canSubmit).toBe(false);
        controller.submit();
        await flush();
        expect(controller.getPublicState().status).not.toBe("submitting");
        expect(sdk.update).not.toHaveBeenCalled();
        expect(sdk.createPayment).not.toHaveBeenCalled();
        controller.deactivate();
    });

    it("reports a checkout totals conflict distinctly and refreshes the session", async () => {
        sdk.get.mockResolvedValue(session({ total: 5_000, amount_remaining: 5_000 } as any));
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        fillCard(controller);
        sdk.createPayment.mockResolvedValueOnce({
            object: "error",
            error: {
                type: "invalid_request_error",
                code: "amount_exceeds_available",
                message: "The provided amount exceeds the amount currently available.",
            },
        });
        controller.submit();
        sdk.get.mockResolvedValue(
            session({ updated_at: 2, total: 5_500, amount_remaining: 5_500 } as any),
        );
        const fetches = sdk.get.mock.calls.length;
        await vi.waitFor(() =>
            expect(controller.getPublicState().submissionError?.message).toBe(
                "Checkout details changed. Review the updated total and try again.",
            ),
        );
        // One read to compare the payable amount, then a canonical refresh.
        await vi.waitFor(() => expect(sdk.get.mock.calls.length).toBeGreaterThan(fetches + 1));
        controller.deactivate();
    });

    it("explains an in-flight payment when a pinned amount is refused but the total is unchanged", async () => {
        sdk.get.mockResolvedValue(session({ total: 5_000, amount_remaining: 5_000 } as any));
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        fillCard(controller);
        sdk.createPayment.mockResolvedValueOnce({
            object: "error",
            error: {
                type: "invalid_request_error",
                code: "amount_exceeds_available",
                message:
                    "The provided amount '$50.00' exceeds the amount currently available on checkout session 'cs_test' ('$0.00').",
            },
        });
        controller.submit();
        await vi.waitFor(() =>
            expect(controller.getPublicState()).toMatchObject({
                status: "failed",
                submissionError: {
                    message: "A payment for this checkout is already processing.",
                },
            }),
        );
        expect(controller.getPublicState().submissionError?.message).not.toContain("cs_");
        controller.deactivate();
    });

    it("does not treat an earlier failed payment as the result of an ambiguous frame change", async () => {
        const earlier = session({
            payments: [{ id: "pay_earlier", status: "failed" }] as any,
        });
        sdk.get.mockResolvedValue(earlier);
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        fillCard(controller);
        sdk.createPayment
            .mockImplementationOnce(() => new Promise(() => {}))
            .mockResolvedValue(IDEMPOTENCY_IN_USE);
        controller.submit();
        await flush();
        controller.updateConfig({ clientSecret: "cs_1", frameUrl: "https://other.example" });
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(controller.getPublicState()).toMatchObject({
            status: "submitting",
            canSubmit: false,
        });
        controller.deactivate();
    });

    it("resolves a card payment whose request fails after it was sent by replaying it", async () => {
        const onComplete = vi.fn();
        const controller = new BiasController({ clientSecret: "cs_1", onComplete });
        controller.activate();
        await flush();
        fillCard(controller);
        sdk.createPayment
            .mockRejectedValueOnce(new TypeError("network failed"))
            .mockResolvedValueOnce({ object: "payment", id: "pay_new", status: "succeeded" });
        controller.submit();
        await vi.waitFor(() => expect(controller.getPublicState().status).toBe("succeeded"));
        expect(controller.getPublicState().submissionError).toBeNull();
        expect(sdk.createPayment).toHaveBeenCalledTimes(2);
        expectIdenticalReplays(sdk.createPayment.mock.calls);
        await new Promise((resolve) => setTimeout(resolve, 1_050));
        expect(onComplete).toHaveBeenCalledOnce();
        controller.deactivate();
    });

    it("never attributes an earlier declined payment to a later ambiguous attempt", async () => {
        const onComplete = vi.fn();
        const controller = new BiasController({ clientSecret: "cs_1", onComplete });
        controller.activate();
        await flush();
        fillCard(controller);
        sdk.createPayment.mockResolvedValueOnce({
            object: "error",
            error: {
                type: "payment_error",
                message: "Your card was declined.",
                customer_message: "Your card was declined.",
            },
        });
        controller.submit();
        await vi.waitFor(() => expect(controller.getPublicState().status).toBe("failed"));
        // The decline left a failed payment on the session; no session event announced it.
        sdk.get.mockResolvedValue(
            session({
                payments: [
                    {
                        id: "pay_1",
                        status: "failed",
                        payment_error: { message: "Your card was declined." },
                    },
                ] as any,
            }),
        );
        controller.getFrame("cardNumber").setEncryptedData("enc_card_b");
        sdk.createPayment
            .mockRejectedValueOnce(new TypeError("network failed"))
            .mockResolvedValueOnce(IDEMPOTENCY_IN_USE)
            .mockResolvedValueOnce({ object: "payment", id: "pay_2", status: "succeeded" });
        controller.submit();
        await vi.waitFor(() => expect(controller.getPublicState().status).toBe("succeeded"));
        expect(controller.getPublicState().submissionError).toBeNull();
        const calls = sdk.createPayment.mock.calls;
        expect(calls).toHaveLength(4);
        expectIdenticalReplays(calls.slice(1));
        expect(calls[1]![1].idempotencyKey).not.toBe(calls[0]![1].idempotencyKey);
        await new Promise((resolve) => setTimeout(resolve, 1_050));
        expect(onComplete).toHaveBeenCalledOnce();
        controller.deactivate();
    });

    it("resolves rather than reports an original request whose key is still in use", async () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        fillCard(controller);
        sdk.createPayment
            .mockResolvedValueOnce(IDEMPOTENCY_IN_USE)
            .mockResolvedValueOnce({ object: "payment", id: "pay_new", status: "succeeded" });
        controller.submit();
        await flush();
        expect(controller.getPublicState()).toMatchObject({
            status: "submitting",
            submissionError: null,
        });
        await vi.waitFor(() => expect(controller.getPublicState().status).toBe("succeeded"));
        expectIdenticalReplays(sdk.createPayment.mock.calls);
        controller.deactivate();
    });

    it("keeps a sent card payment locked while its replayed payment is still processing", async () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        fillCard(controller);
        sdk.createPayment
            .mockRejectedValueOnce(new TypeError("network failed"))
            .mockResolvedValueOnce({ object: "payment", id: "pay_new", status: "processing" });
        sdk.get.mockResolvedValue(
            session({ updated_at: 2, payments: [{ id: "pay_new", status: "processing" }] as any }),
        );
        controller.submit();
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        expect(controller.getPublicState()).toMatchObject({
            status: "submitting",
            canSubmit: false,
            submissionError: null,
        });
        controller.getField("postalCode").setValue("10001");
        expect(controller.getField("postalCode").state.value).toBe("94110");
        expect(sdk.createPayment).toHaveBeenCalledTimes(2);
        controller.deactivate();
    });

    it("settles a request that failed in transit with its replay's own answer", async () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        fillCard(controller);
        sdk.createPayment
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockResolvedValueOnce({
                object: "error",
                error: {
                    type: "payment_error",
                    message: "Your card was declined.",
                    customer_message: "Your card was declined.",
                },
            });
        controller.submit();
        await vi.waitFor(() =>
            expect(controller.getPublicState()).toMatchObject({
                status: "failed",
                canSubmit: true,
                submissionError: {
                    code: "payment_failed",
                    retryable: true,
                    message: "Your card was declined.",
                },
            }),
        );
        expect(sdk.createPayment).toHaveBeenCalledTimes(2);
        expectIdenticalReplays(sdk.createPayment.mock.calls);
        controller.deactivate();
    });

    it("stays locked while replays keep failing", async () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        fillCard(controller);
        sdk.createPayment.mockRejectedValue(new TypeError("Failed to fetch"));
        controller.submit();
        // An unknown outcome must not be reported as failed.
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        expect(controller.getPublicState()).toMatchObject({
            status: "submitting",
            canSubmit: false,
            submissionError: null,
        });
        expectIdenticalReplays(sdk.createPayment.mock.calls);
        controller.deactivate();
    });

    it("settles once a replay reaches the API after transient failures", async () => {
        const onComplete = vi.fn();
        const controller = new BiasController({ clientSecret: "cs_1", onComplete });
        controller.activate();
        await flush();
        fillCard(controller);
        sdk.createPayment
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockResolvedValueOnce({ object: "payment", id: "pay_new", status: "succeeded" });
        controller.submit();
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        expect(controller.getPublicState().status).toBe("submitting");
        await vi.waitFor(() => expect(controller.getPublicState().status).toBe("succeeded"), {
            timeout: 3_000,
        });
        expect(sdk.createPayment).toHaveBeenCalledTimes(4);
        expectIdenticalReplays(sdk.createPayment.mock.calls);
        controller.deactivate();
    });

    describe("an attempt its idempotency key can't replay", () => {
        async function submitCard(...responses: unknown[]) {
            vi.useFakeTimers();
            const onComplete = vi.fn();
            const controller = new BiasController({ clientSecret: "cs_1", onComplete });
            controller.activate();
            await vi.advanceTimersByTimeAsync(0);
            fillCard(controller);
            for (const response of responses) {
                if (response instanceof Error) sdk.createPayment.mockRejectedValueOnce(response);
                else sdk.createPayment.mockResolvedValueOnce(response);
            }
            controller.submit();
            await vi.advanceTimersByTimeAsync(0);
            return { controller, onComplete };
        }

        it("completes once the session shows the checkout paid", async () => {
            try {
                const { controller, onComplete } = await submitCard(IDEMPOTENCY_OUTCOME_UNKNOWN);
                expect(controller.getPublicState()).toMatchObject({
                    status: "processing",
                    canSubmit: false,
                    submissionError: null,
                });
                sdk.get.mockResolvedValue(session({ updated_at: 2, status: "complete" } as any));
                await vi.advanceTimersByTimeAsync(1_000);
                expect(controller.getPublicState().status).toBe("succeeded");
                await vi.advanceTimersByTimeAsync(1_050);
                expect(onComplete).toHaveBeenCalledOnce();
                // The key is never re-sent.
                expect(sdk.createPayment).toHaveBeenCalledOnce();
                controller.deactivate();
            } finally {
                vi.useRealTimers();
            }
        });

        it("follows a new payment for the sent amount, ignoring earlier ones", async () => {
            try {
                sdk.get.mockResolvedValue(
                    session({
                        payments: [{ id: "pay_old", status: "failed", amount: 5_000 }] as any,
                    }),
                );
                const { controller } = await submitCard(
                    new TypeError("network failed"),
                    IDEMPOTENCY_OUTCOME_UNKNOWN,
                );
                await vi.advanceTimersByTimeAsync(250);
                expect(sdk.createPayment).toHaveBeenCalledTimes(2);
                expectIdenticalReplays(sdk.createPayment.mock.calls);
                // Still only the earlier payment: keep looking.
                await vi.advanceTimersByTimeAsync(1_000);
                expect(controller.getPublicState().status).toBe("processing");
                sdk.get.mockResolvedValue(
                    session({
                        updated_at: 3,
                        payments: [
                            { id: "pay_old", status: "failed", amount: 5_000 },
                            {
                                id: "pay_new",
                                status: "failed",
                                amount: 5_000,
                                payment_error: { message: "Your card was declined." },
                            },
                        ] as any,
                    }),
                );
                await vi.advanceTimersByTimeAsync(2_000);
                expect(controller.getPublicState()).toMatchObject({
                    status: "failed",
                    canSubmit: true,
                    submissionError: { message: "Your card was declined." },
                });
                expect(sdk.createPayment).toHaveBeenCalledTimes(2);
                controller.deactivate();
            } finally {
                vi.useRealTimers();
            }
        });

        it("fails as unconfirmed, unlocking the form, only once the session reads run out", async () => {
            try {
                const { controller } = await submitCard(IDEMPOTENCY_OUTCOME_UNKNOWN);
                await vi.advanceTimersByTimeAsync(10_000);
                expect(controller.getPublicState()).toMatchObject({
                    status: "processing",
                    canSubmit: false,
                });
                for (
                    let elapsed = 10_000;
                    elapsed < 600_000 && controller.getPublicState().status !== "failed";
                    elapsed += 10_000
                ) {
                    await vi.advanceTimersByTimeAsync(10_000);
                }
                expect(controller.getPublicState()).toMatchObject({
                    status: "failed",
                    canSubmit: true,
                    submissionError: {
                        message:
                            "We couldn't confirm your payment. Check with the merchant before trying again.",
                    },
                });
                // No more reads once it gave up.
                await vi.advanceTimersByTimeAsync(60_000);
                const settled = sdk.get.mock.calls.length;
                await vi.advanceTimersByTimeAsync(60_000);
                expect(sdk.get.mock.calls.length).toBe(settled);
                expect(sdk.createPayment).toHaveBeenCalledOnce();
                controller.deactivate();
            } finally {
                vi.useRealTimers();
            }
        });

        it("reconciles on an idempotency error without a code", async () => {
            try {
                const { controller } = await submitCard({
                    object: "error",
                    error: { type: "idempotency_error", code: null, message: "Unknown outcome." },
                });
                expect(controller.getPublicState().status).toBe("processing");
                await vi.advanceTimersByTimeAsync(5_000);
                expect(sdk.createPayment).toHaveBeenCalledOnce();
                controller.deactivate();
            } finally {
                vi.useRealTimers();
            }
        });

        it("fails at once when the key was used with different parameters", async () => {
            try {
                const { controller } = await submitCard(new TypeError("network failed"), {
                    object: "error",
                    error: {
                        type: "idempotency_error",
                        code: "idempotency_params_mismatch",
                        message:
                            "Keys for idempotent requests can only be used with the same parameters.",
                    },
                });
                await vi.advanceTimersByTimeAsync(250);
                expect(controller.getPublicState()).toMatchObject({
                    status: "failed",
                    canSubmit: true,
                    submissionError: {
                        message:
                            "We couldn't confirm your payment. Check with the merchant before trying again.",
                    },
                });
                await vi.advanceTimersByTimeAsync(10_000);
                expect(sdk.createPayment).toHaveBeenCalledTimes(2);
                controller.deactivate();
            } finally {
                vi.useRealTimers();
            }
        });
    });

    it("follows a processing card payment past the bounded schedule until it fails", async () => {
        vi.useFakeTimers();
        try {
            const controller = new BiasController({ clientSecret: "cs_1" });
            controller.activate();
            await vi.advanceTimersByTimeAsync(0);
            fillCard(controller);
            sdk.createPayment.mockResolvedValueOnce({
                object: "payment",
                id: "pay_new",
                status: "processing",
            });
            // A payment in review: the session never announces anything while it waits.
            sdk.get.mockResolvedValue(
                session({ payments: [{ id: "pay_new", status: "processing" }] as any }),
            );
            controller.submit();
            await vi.advanceTimersByTimeAsync(10_000);
            expect(controller.getPublicState()).toMatchObject({
                status: "submitting",
                canSubmit: false,
            });
            await vi.advanceTimersByTimeAsync(10_000);
            // Still unknown after the bounded schedule: processing, not an endless spinner.
            expect(controller.getPublicState()).toMatchObject({
                status: "processing",
                canSubmit: false,
                submissionError: null,
            });
            controller.submit();
            expect(sdk.createPayment).toHaveBeenCalledOnce();
            sdk.get.mockResolvedValue(
                session({
                    payments: [
                        {
                            id: "pay_new",
                            status: "failed",
                            payment_error: { message: "The payment was declined after review." },
                        },
                    ] as any,
                }),
            );
            await vi.advanceTimersByTimeAsync(30_000);
            expect(controller.getPublicState()).toMatchObject({
                status: "failed",
                canSubmit: true,
                submissionError: { message: "The payment was declined after review." },
            });
            controller.deactivate();
        } finally {
            vi.useRealTimers();
        }
    });

    it("completes a processing card payment that succeeds after the bounded schedule", async () => {
        vi.useFakeTimers();
        try {
            const onComplete = vi.fn();
            const controller = new BiasController({ clientSecret: "cs_1", onComplete });
            controller.activate();
            await vi.advanceTimersByTimeAsync(0);
            fillCard(controller);
            sdk.createPayment.mockResolvedValueOnce({
                object: "payment",
                id: "pay_new",
                status: "processing",
            });
            sdk.get.mockResolvedValue(
                session({ payments: [{ id: "pay_new", status: "processing" }] as any }),
            );
            controller.submit();
            await vi.advanceTimersByTimeAsync(20_000);
            expect(controller.getPublicState().status).toBe("processing");
            sdk.get.mockResolvedValue(
                session({
                    updated_at: 2,
                    payments: [{ id: "pay_new", status: "succeeded" }] as any,
                }),
            );
            await vi.advanceTimersByTimeAsync(30_000);
            expect(controller.getPublicState().status).toBe("succeeded");
            await vi.advanceTimersByTimeAsync(1_000);
            expect(onComplete).toHaveBeenCalledOnce();
            controller.deactivate();
        } finally {
            vi.useRealTimers();
        }
    });

    function fillBank(controller: BiasController) {
        controller.setPaymentMethod("us_bank_account");
        controller.getField("name").setValue("Jane Doe");
        controller.getField("postalCode").setValue("94110");
        controller.getFrame("bankAccountNumber").setEncryptedData("enc");
        controller.getFrame("bankRoutingNumber").setEncryptedData("enc");
    }

    it("completes a bank payment that is processing until settlement", async () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        fillBank(controller);
        sdk.createPayment.mockResolvedValueOnce({
            object: "payment",
            id: "pay_ach",
            status: "processing",
        });
        controller.submit();
        await vi.waitFor(() => expect(controller.getPublicState().status).toBe("succeeded"));
        controller.deactivate();
    });

    it.each([
        [
            "failed",
            { message: "The bank account could not be debited." },
            "The bank account could not be debited.",
        ],
        ["canceled", null, "The payment failed and may now be retried."],
    ] as const)(
        "reports a bank payment the API answered as %s as a failure",
        async (status, paymentError, message) => {
            const onComplete = vi.fn();
            const controller = new BiasController({ clientSecret: "cs_1", onComplete });
            controller.activate();
            await flush();
            fillBank(controller);
            sdk.createPayment.mockResolvedValueOnce({
                object: "payment",
                id: "pay_ach",
                status,
                payment_error: paymentError,
            });
            controller.submit();
            await vi.waitFor(() =>
                expect(controller.getPublicState()).toMatchObject({
                    status: "failed",
                    canSubmit: true,
                    submissionError: { code: "payment_failed", message },
                }),
            );
            await new Promise((resolve) => setTimeout(resolve, 1_050));
            expect(controller.getPublicState().status).toBe("failed");
            expect(onComplete).not.toHaveBeenCalled();
            controller.deactivate();
        },
    );

    it("resolves an ambiguous bank payment as successful once it is processing", async () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        fillBank(controller);
        sdk.createPayment
            .mockRejectedValueOnce(new TypeError("network failed"))
            .mockResolvedValueOnce({ object: "payment", id: "pay_ach", status: "processing" });
        controller.submit();
        await vi.waitFor(() => expect(controller.getPublicState().status).toBe("succeeded"));
        expectIdenticalReplays(sdk.createPayment.mock.calls);
        controller.deactivate();
    });

    it("treats a processing card payment as pending until the session reports success", async () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        fillCard(controller);
        sdk.createPayment.mockResolvedValueOnce({
            object: "payment",
            id: "pay_new",
            status: "processing",
        });
        sdk.get
            .mockResolvedValueOnce(
                session({
                    updated_at: 2,
                    payments: [{ id: "pay_new", status: "processing" }] as any,
                }),
            )
            .mockResolvedValueOnce(
                session({
                    updated_at: 3,
                    payments: [{ id: "pay_new", status: "succeeded" }] as any,
                }),
            );
        controller.submit();
        await flush();
        await flush();
        expect(controller.getPublicState()).toMatchObject({
            status: "submitting",
            canSubmit: false,
        });
        await vi.waitFor(() => expect(controller.getPublicState().status).toBe("succeeded"));
        controller.deactivate();
    });

    it("resolves an in-flight payment when checkout expansion changes", async () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        fillCard(controller);
        sdk.createPayment
            .mockImplementationOnce(() => new Promise(() => {}))
            .mockResolvedValueOnce({ object: "payment", id: "pay_new", status: "succeeded" });
        controller.submit();
        await flush();
        controller.updateConfig({
            clientSecret: "cs_1",
            checkoutSessionExpand: { line_items: { price: true } },
        });
        expect(controller.getPublicState().status).toBe("submitting");
        await vi.waitFor(() => expect(controller.getPublicState().status).toBe("succeeded"));
        expect(sdk.createPayment).toHaveBeenCalledTimes(2);
        expectIdenticalReplays(sdk.createPayment.mock.calls);
        controller.deactivate();
    });

    it("keeps the API's answer when a frame change lands while a refused amount is checked", async () => {
        sdk.get.mockResolvedValue(session({ total: 5_000, amount_remaining: 5_000 } as any));
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        fillCard(controller);
        sdk.createPayment.mockResolvedValueOnce({
            object: "error",
            error: {
                type: "invalid_request_error",
                code: "amount_exceeds_available",
                message:
                    "The provided amount '$50.00' exceeds the amount currently available on checkout session 'cs_test' ('$0.00').",
            },
        });
        let resolveCheck: ((value: CheckoutSession) => void) | undefined;
        sdk.get.mockImplementationOnce(() => new Promise((resolve) => (resolveCheck = resolve)));
        controller.submit();
        await vi.waitFor(() => expect(resolveCheck).toBeTypeOf("function"));
        controller.updateConfig({ clientSecret: "cs_1", frameUrl: "https://other.example" });
        expect(controller.getPublicState()).toMatchObject({
            status: "submitting",
            canSubmit: false,
        });
        resolveCheck!(session({ total: 5_000, amount_remaining: 5_000 } as any));
        await vi.waitFor(() =>
            expect(controller.getPublicState()).toMatchObject({
                status: "failed",
                submissionError: { message: "A payment for this checkout is already processing." },
            }),
        );
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(controller.getPublicState().submissionError?.message).toBe(
            "A payment for this checkout is already processing.",
        );
        // The API answered, so the request is never replayed.
        expect(sdk.createPayment).toHaveBeenCalledOnce();
        controller.deactivate();
    });

    it("returns to idle when a frame change cancels an attempt before its payment was sent", async () => {
        sdk.update.mockResolvedValue(session({ updated_at: 2 }));
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        controller.registerCollector({ kind: "contact", fields: ["email"] });
        controller.getField("email").setValue("shopper@example.com");
        fillCard(controller);
        await new Promise((resolve) => setTimeout(resolve, 400));
        const updates = sdk.update.mock.calls.length;
        sdk.update.mockImplementationOnce(() => new Promise(() => {}));
        controller.submit();
        await flush();
        expect(sdk.update).toHaveBeenCalledTimes(updates + 1);
        expect(controller.getPublicState().status).toBe("submitting");
        controller.updateConfig({ clientSecret: "cs_1", frameUrl: "https://other.example" });
        expect(controller.getPublicState()).toMatchObject({ status: "idle" });
        expect(sdk.createPayment).not.toHaveBeenCalled();
        controller.deactivate();
    });

    it("clears disposable registrations and listeners on deactivate", async () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        const dispose = vi.fn();
        controller.registerCollector({ kind: "contact", fields: ["email"] });
        controller.registerFrame({ field: "cardNumber", triggerValidation() {}, dispose });
        const listener = vi.fn();
        controller.subscribe(listener);
        controller.activate();
        await flush();
        controller.deactivate();
        expect(dispose).toHaveBeenCalledOnce();
        controller.activate();
        await flush();
        expect(controller.hasCollector("contact")).toBe(false);
        listener.mockClear();
        controller.getField("email").setValue("new@example.com");
        expect(listener).not.toHaveBeenCalled();
    });

    it("uses the latest completion callback and calls it once", async () => {
        vi.useFakeTimers();
        const first = vi.fn();
        const latest = vi.fn();
        const controller = new BiasController({
            clientSecret: "cs_1",
            onComplete: first,
        });
        controller.activate();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        controller.updateConfig({
            clientSecret: "cs_1",
            onComplete: latest,
        });
        controller.getField("postalCode").setValue("94110");
        for (const field of ["cardNumber", "cardExpiry", "cardCvc"] as const)
            controller.getFrame(field).setEncryptedData("enc");
        controller.submit();
        await vi.advanceTimersByTimeAsync(0);
        expect(controller.getPublicState().status).toBe("succeeded");
        expect(first).not.toHaveBeenCalled();
        expect(latest).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(999);
        expect(latest).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(latest).toHaveBeenCalledOnce();
        vi.useRealTimers();
    });

    it("warns and does nothing for inactive imperative operations", () => {
        const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.refreshSession();
        controller.submit();
        controller.setPaymentMethod("card");
        expect(sdk.get).not.toHaveBeenCalled();
        expect(warning).toHaveBeenCalledWith(expect.stringContaining("refreshSession"));
        expect(warning).toHaveBeenCalledWith(expect.stringContaining("submit"));
        expect(warning).toHaveBeenCalledWith(expect.stringContaining("setPaymentMethod"));
        warning.mockRestore();
    });

    it("does not restart a terminal pre-activation configuration failure", async () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.registerPaymentElement();
        expect(() => controller.registerPaymentElement("card")).toThrow();
        controller.activate();
        await flush();
        expect(sdk.get).not.toHaveBeenCalled();
        expect(controller.getPublicState().sessionState).toMatchObject({
            status: "error",
            error: { code: "configuration_error" },
        });
    });

    it("prepares Apple Pay without making wallet absence a terminal session error", async () => {
        sdk.get.mockResolvedValueOnce(
            session({
                total: 1299,
                amount_remaining: 1299,
                amount_collected: 0,
                payment_method_types: ["apple_pay"],
                currency: "USD",
            } as any),
        );
        sdk.walletConfiguration.mockResolvedValueOnce({ apple_pay: null });
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();

        await expect(controller.prepareApplePay()).resolves.toBeNull();
        expect(controller.getPublicState().sessionState.status).toBe("ready");
        expect(controller.getPublicState().submissionError).toBeNull();
        controller.deactivate();
    });

    it("submits an Apple Pay token unchanged once and omits future usage", async () => {
        sdk.get.mockResolvedValueOnce(
            session({
                total: 1299,
                amount_remaining: 1099,
                amount_collected: 200,
                payment_method_types: ["apple_pay"],
                payments: [],
                currency: "USD",
                billing_details_collection: true,
                billing_details: {
                    name: "Canonical Name",
                    address: {
                        line1: "12 Canonical Street",
                        line2: null,
                        city: "London",
                        state: "London",
                        postal_code: "OLD POSTCODE",
                        country: "GB",
                    },
                },
            } as any),
        );
        sdk.applePayUpdate.mockResolvedValueOnce(
            session({
                updated_at: 2,
                total: 1299,
                amount_remaining: 1099,
                amount_collected: 200,
                payment_method_types: ["apple_pay"],
                payments: [],
                currency: "USD",
                billing_details_collection: true,
                billing_details: {
                    name: "Ada Lovelace",
                    address: {
                        line1: "12 Canonical Street",
                        line2: null,
                        city: "London",
                        state: "London",
                        postal_code: "SW1Y 4LB",
                        country: "GB",
                    },
                },
                shipping_options: [],
            } as any),
        );
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        await controller.prepareApplePay();
        controller.setWalletAvailability("apple_pay", "available");
        const presentation = controller.beginApplePayPresentation();
        expect(presentation).toMatchObject({
            amount: 1099,
            currency: "USD",
            requiresBillingContact: true,
        });
        expect(controller.beginApplePayPresentation()).toBeNull();

        const paymentData = {
            version: "EC_v1",
            data: "opaque-data",
            signature: "opaque-signature",
            header: {
                ephemeralPublicKey: "opaque-key",
                publicKeyHash: "opaque-hash",
                transactionId: "opaque-id",
            },
        } as const;
        await expect(
            controller.authorizeApplePay(presentation!, paymentData, {
                givenName: "  Ada ",
                familyName: " Lovelace  ",
                postalCode: " SW1Y 4LB ",
                countryCode: "xx",
            }),
        ).resolves.toBe("success");

        const params = sdk.createPayment.mock.calls[0]![0];
        expect(params).toMatchObject({
            amount: 1099,
            checkout_session_updated_at: 2,
            remember: false,
            payment_method: {
                apple_pay: { payment_data: paymentData },
                billing_details: {
                    name: "Ada Lovelace",
                    address: {
                        line1: "12 Canonical Street",
                        city: "London",
                        state: "London",
                        country: "GB",
                        postal_code: "SW1Y 4LB",
                    },
                },
            },
        });
        expect(params.payment_method.apple_pay.payment_data).toBe(paymentData);
        expect(params.payment_method).not.toHaveProperty("setup_future_usage");
        const [finalRequest, finalRequestConfig] = sdk.applePayUpdate.mock.calls[0]!;
        expect(finalRequest).toMatchObject({
            checkout_session_updated_at: 1,
            final: true,
            billing_contact: {
                givenName: "  Ada ",
                familyName: " Lovelace  ",
                postalCode: " SW1Y 4LB ",
                countryCode: "xx",
            },
        });
        expect(finalRequestConfig).toEqual({ signal: expect.any(AbortSignal) });
        expect(JSON.stringify(controller.getPublicState())).not.toContain("opaque-data");
        controller.deactivate();
    });

    it("puts the canonical selected shipping method first in an initial Apple Pay request", async () => {
        const canonical = session({
            total: 1500,
            amount_remaining: 1500,
            amount_collected: 0,
            payment_method_types: ["apple_pay"],
            currency: "USD",
            shipping_address_collection: { allowed_countries: ["US"] },
            shipping_options: [
                {
                    shipping_amount: 200,
                    shipping_rate: {
                        id: "shr_standard",
                        display_name: "Standard",
                        delivery_estimate: null,
                    },
                },
                {
                    shipping_amount: 500,
                    shipping_rate: {
                        id: "shr_express",
                        display_name: "Express",
                        delivery_estimate: null,
                    },
                },
            ],
            shipping_cost: {
                amount: 500,
                shipping_rate: {
                    id: "shr_express",
                    display_name: "Express",
                    delivery_estimate: null,
                },
            },
        } as any);
        sdk.get.mockResolvedValueOnce(canonical);
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        await controller.prepareApplePay();
        controller.setWalletAvailability("apple_pay", "available");

        expect(
            controller.beginApplePayPresentation()?.shippingMethods.map((rate) => rate.identifier),
        ).toEqual(["shr_express", "shr_standard"]);
        controller.cancelWalletPresentation("apple_pay");
        controller.deactivate();
    });

    it("starts express Apple Pay before shipping is settled and applies authoritative callbacks", async () => {
        const canonical = session({
            total: 2500,
            amount_remaining: 2500,
            amount_collected: 0,
            payment_method_types: ["apple_pay"],
            currency: "USD",
            shipping_options_pending: true,
            shipping_address_collection: { allowed_countries: ["US"] },
            shipping_details: null,
            shipping_options: [],
            shipping_cost: null,
        } as any);
        sdk.get.mockResolvedValueOnce(canonical);
        const updated = session({
            ...canonical,
            updated_at: 2,
            total: 3000,
            amount_remaining: 3000,
            shipping_options_pending: false,
            shipping_options: [
                {
                    shipping_amount: 200,
                    shipping_rate: {
                        id: "shr_standard",
                        display_name: "Standard",
                        delivery_estimate: null,
                    },
                },
                {
                    shipping_amount: 500,
                    shipping_rate: {
                        id: "shr_1",
                        display_name: "Express",
                        delivery_estimate: {
                            minimum: { value: 1, unit: "business_day" },
                            maximum: { value: 2, unit: "business_day" },
                        },
                    },
                },
            ],
            shipping_cost: {
                amount: 500,
                shipping_rate: {
                    id: "shr_1",
                    display_name: "Express",
                    delivery_estimate: null,
                },
            },
        } as any);
        sdk.applePayUpdate.mockResolvedValueOnce(updated);
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        await controller.prepareApplePay();
        controller.setWalletAvailability("apple_pay", "available");

        const presentation = controller.beginApplePayPresentation()!;
        expect(presentation).toMatchObject({
            amount: 2500,
            requiresEmail: true,
            requiresShippingContact: true,
            shippingMethods: [],
        });
        const nativeContact = {
            givenName: "Ada",
            emailAddress: "ada@example.com",
            phoneNumber: "+14155550123",
            administrativeArea: "CA",
            postalCode: "94105",
            countryCode: "US",
            country: "United States",
            phoneticGivenName: "A-da",
            subLocality: "SOMA",
        };
        await expect(
            controller.updateApplePayShippingContact(presentation, nativeContact),
        ).resolves.toEqual({
            amount: 3000,
            shippingMethods: [
                {
                    identifier: "shr_1",
                    label: "Express",
                    detail: "1 business day–2 business days",
                    amount: 500,
                },
                {
                    identifier: "shr_standard",
                    label: "Standard",
                    detail: "",
                    amount: 200,
                },
            ],
        });
        expect(presentation).toMatchObject({ updatedAt: 2, amount: 3000 });
        const [request, requestConfig] = sdk.applePayUpdate.mock.calls[0]!;
        expect(request).toEqual({
            checkout_session_updated_at: 1,
            shipping_contact: {
                givenName: "Ada",
                emailAddress: "ada@example.com",
                phoneNumber: "+14155550123",
                administrativeArea: "CA",
                postalCode: "94105",
                countryCode: "US",
            },
        });
        expect(requestConfig).toEqual({ signal: expect.any(AbortSignal) });
        controller.cancelWalletPresentation("apple_pay");
        controller.deactivate();
    });

    it("serializes rapid Apple Pay callbacks and advances the canonical version before the next mutation", async () => {
        const canonical = session({
            total: 1000,
            amount_remaining: 1000,
            amount_collected: 0,
            payment_method_types: ["apple_pay"],
            currency: "USD",
            shipping_address_collection: { allowed_countries: ["US"] },
            shipping_options: [],
            shipping_cost: null,
        } as any);
        const afterContact = session({
            ...canonical,
            updated_at: 2,
            shipping_options: [
                {
                    shipping_amount: 500,
                    shipping_rate: {
                        id: "shr_express",
                        display_name: "Express",
                        delivery_estimate: null,
                    },
                },
            ],
        } as any);
        const afterMethod = session({
            ...afterContact,
            updated_at: 3,
            total: 1500,
            amount_remaining: 1500,
            shipping_cost: {
                amount: 500,
                shipping_rate: {
                    id: "shr_express",
                    display_name: "Express",
                    delivery_estimate: null,
                },
            },
        } as any);
        const afterFinal = session({ ...afterMethod, updated_at: 4 } as any);
        sdk.get.mockResolvedValueOnce(canonical);
        let resolveContact!: (response: CheckoutSession) => void;
        sdk.applePayUpdate
            .mockReturnValueOnce(
                new Promise<CheckoutSession>((resolve) => {
                    resolveContact = resolve;
                }),
            )
            .mockResolvedValueOnce(afterMethod)
            .mockResolvedValueOnce(afterFinal);
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        await controller.prepareApplePay();
        controller.setWalletAvailability("apple_pay", "available");
        const presentation = controller.beginApplePayPresentation()!;

        const contactUpdate = controller.updateApplePayShippingContact(presentation, {
            postalCode: "94105",
            countryCode: "US",
        });
        await Promise.resolve();
        expect(sdk.applePayUpdate).toHaveBeenCalledTimes(1);

        // Model the checkout-session event arriving before the direct mutation response.
        canonical.updated_at = 2;
        const methodUpdate = controller.updateApplePayShippingMethod(presentation, "shr_express");
        const authorization = controller.authorizeApplePay(presentation, {} as any, undefined, {
            givenName: "Ada",
            familyName: "Lovelace",
            emailAddress: "ada@example.com",
            addressLines: ["1 Main St"],
            locality: "San Francisco",
            administrativeArea: "CA",
            postalCode: "94105",
            countryCode: "US",
        });

        resolveContact(afterContact);
        await expect(contactUpdate).resolves.toMatchObject({ amount: 1000 });
        // The final update may already be queued behind it; only the order matters here.
        await vi.waitFor(() =>
            expect(sdk.applePayUpdate.mock.calls.length).toBeGreaterThanOrEqual(2),
        );
        const [methodRequest, methodRequestConfig] = sdk.applePayUpdate.mock.calls[1]!;
        expect(methodRequest).toEqual({
            checkout_session_updated_at: 2,
            shipping_rate: "shr_express",
        });
        expect(methodRequestConfig).toEqual({ signal: expect.any(AbortSignal) });
        await expect(methodUpdate).resolves.toMatchObject({ amount: 1500 });
        await vi.waitFor(() => expect(sdk.applePayUpdate).toHaveBeenCalledTimes(3));
        const [finalRequest, finalRequestConfig] = sdk.applePayUpdate.mock.calls[2]!;
        expect(finalRequest).toMatchObject({
            checkout_session_updated_at: 3,
            final: true,
            shipping_rate: "shr_express",
        });
        expect(finalRequestConfig).toEqual({ signal: expect.any(AbortSignal) });
        await expect(authorization).resolves.toBe("success");
        expect(presentation).toMatchObject({
            updatedAt: 4,
            amount: 1500,
            selectedShippingRate: "shr_express",
        });
        expect(sdk.createPayment.mock.calls[0]?.[0]).toMatchObject({
            checkout_session_updated_at: 4,
            amount: 1500,
        });
        controller.deactivate();
    });

    it("persists an email-only Apple Pay contact before creating payment", async () => {
        const canonical = session({
            total: 1000,
            amount_remaining: 1000,
            amount_collected: 0,
            payment_method_types: ["apple_pay"],
            payments: [],
            currency: "USD",
            shipping_address_collection: null,
            shipping_options: [],
            shipping_cost: null,
        } as any);
        sdk.get.mockResolvedValueOnce(canonical);
        sdk.applePayUpdate.mockResolvedValueOnce(
            session({
                ...canonical,
                updated_at: 2,
                customer_details: {
                    email: "ada@example.com",
                    name: null,
                    phone: null,
                },
            } as any),
        );
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        await controller.prepareApplePay();
        controller.setWalletAvailability("apple_pay", "available");
        const presentation = controller.beginApplePayPresentation()!;

        await expect(
            controller.authorizeApplePay(presentation, {} as any, undefined, {
                emailAddress: "ada@example.com",
            }),
        ).resolves.toBe("success");

        const [finalRequest, finalRequestConfig] = sdk.applePayUpdate.mock.calls[0]!;
        expect(finalRequest).toEqual({
            checkout_session_updated_at: 1,
            final: true,
            shipping_contact: { emailAddress: "ada@example.com" },
        });
        expect(finalRequestConfig).toEqual({ signal: expect.any(AbortSignal) });
        expect(sdk.createPayment.mock.invocationCallOrder[0]).toBeGreaterThan(
            sdk.applePayUpdate.mock.invocationCallOrder[0]!,
        );
        expect(sdk.createPayment.mock.calls[0]?.[0]).toMatchObject({
            amount: 1000,
            checkout_session_updated_at: 2,
        });
        controller.deactivate();
    });

    it("keeps an Apple Pay submission locked after the final contact update", async () => {
        const canonical = session({
            total: 1000,
            amount_remaining: 1000,
            amount_collected: 0,
            payment_method_types: ["card", "apple_pay"],
            payments: [],
            currency: "USD",
            shipping_address_collection: null,
            shipping_options: [],
            shipping_cost: null,
        } as any);
        sdk.get.mockResolvedValueOnce(canonical);
        sdk.applePayUpdate.mockResolvedValueOnce(session({ ...canonical, updated_at: 2 } as any));
        let resolvePayment!: (payment: unknown) => void;
        sdk.createPayment.mockReturnValueOnce(
            new Promise((resolve) => {
                resolvePayment = resolve;
            }),
        );
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        await controller.prepareApplePay();
        controller.setWalletAvailability("apple_pay", "available");
        const presentation = controller.beginApplePayPresentation()!;

        const authorization = controller.authorizeApplePay(presentation, {} as any, undefined, {
            emailAddress: "ada@example.com",
        });
        await vi.waitFor(() => expect(sdk.createPayment).toHaveBeenCalledTimes(1));
        expect(controller.getPublicState().status).toBe("submitting");
        expect(controller.getPublicState().canSubmit).toBe(false);

        resolvePayment({ object: "payment", id: "pay_test", status: "succeeded" });
        await expect(authorization).resolves.toBe("success");
        expect(controller.getPublicState().status).toBe("succeeded");
        controller.deactivate();
    });

    it("fails authorization when the final authoritative contact update changes the sheet total", async () => {
        const canonical = session({
            total: 1000,
            amount_remaining: 1000,
            amount_collected: 0,
            payment_method_types: ["apple_pay"],
            payments: [],
            currency: "USD",
            shipping_address_collection: { allowed_countries: ["US"] },
            shipping_options: [],
            shipping_cost: null,
        } as any);
        sdk.get.mockResolvedValueOnce(canonical);
        sdk.applePayUpdate.mockResolvedValueOnce(
            session({
                ...canonical,
                updated_at: 2,
                total: 1200,
                amount_remaining: 1200,
            } as any),
        );
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        await controller.prepareApplePay();
        controller.setWalletAvailability("apple_pay", "available");
        const presentation = controller.beginApplePayPresentation()!;

        await expect(
            controller.authorizeApplePay(presentation, {} as any, undefined, {
                givenName: "Ada",
                familyName: "Lovelace",
                emailAddress: "ada@example.com",
                phoneNumber: "+14155550123",
                addressLines: ["123 Main St"],
                locality: "San Francisco",
                administrativeArea: "CA",
                postalCode: "94105",
                countryCode: "US",
            }),
        ).resolves.toBe("failure");

        expect(sdk.createPayment).not.toHaveBeenCalled();
        expect(controller.getPublicState()).toMatchObject({
            status: "failed",
            submissionError: {
                message: "Checkout details changed. Review the updated total and try again.",
            },
        });
        const [request, requestConfig] = sdk.applePayUpdate.mock.calls[0]!;
        expect(request).toMatchObject({
            checkout_session_updated_at: 1,
            final: true,
            shipping_contact: {
                emailAddress: "ada@example.com",
                phoneNumber: "+14155550123",
                addressLines: ["123 Main St"],
            },
        });
        expect(requestConfig).toEqual({ signal: expect.any(AbortSignal) });
        controller.deactivate();
    });

    it("ignores an Apple Pay update response after the native sheet is cancelled", async () => {
        const canonical = session({
            total: 1000,
            amount_remaining: 1000,
            amount_collected: 0,
            payment_method_types: ["apple_pay"],
            currency: "USD",
            shipping_address_collection: { allowed_countries: ["US"] },
            shipping_options: [],
        } as any);
        sdk.get.mockResolvedValueOnce(canonical);
        let resolveUpdate!: (response: CheckoutSession) => void;
        sdk.applePayUpdate.mockReturnValueOnce(
            new Promise<CheckoutSession>((resolve) => {
                resolveUpdate = resolve;
            }),
        );
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        await controller.prepareApplePay();
        controller.setWalletAvailability("apple_pay", "available");
        const presentation = controller.beginApplePayPresentation()!;
        const update = controller.updateApplePayShippingContact(presentation, {
            postalCode: "94105",
            countryCode: "US",
        });
        await Promise.resolve();
        controller.cancelWalletPresentation("apple_pay");
        resolveUpdate(
            session({
                ...canonical,
                updated_at: 2,
                total: 2000,
                amount_remaining: 2000,
            } as CheckoutSession),
        );

        await expect(update).rejects.toMatchObject({ code: "payment_failed" });
        expect(controller.getPublicState()).toMatchObject({ status: "idle" });
        expect(presentation).toMatchObject({ updatedAt: 1, amount: 1000 });
        controller.deactivate();
    });

    it("falls back entirely to canonical billing when Apple provides no billing contact", async () => {
        sdk.get.mockResolvedValueOnce(
            session({
                total: 2500,
                amount_remaining: 2500,
                amount_collected: 0,
                payment_method_types: ["apple_pay"],
                payments: [],
                currency: "USD",
                billing_details: {
                    name: "Canonical Shopper",
                    address: {
                        line1: "1 Main St",
                        line2: "Suite 2",
                        city: "Austin",
                        state: "TX",
                        postal_code: "78701",
                        country: "US",
                    },
                },
            } as any),
        );
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        await controller.prepareApplePay();
        controller.setWalletAvailability("apple_pay", "available");
        const presentation = controller.beginApplePayPresentation()!;
        await controller.authorizeApplePay(presentation, {} as any);

        expect(sdk.createPayment.mock.calls[0]?.[0]).toMatchObject({
            payment_method: {
                billing_details: {
                    name: "Canonical Shopper",
                    address: {
                        line1: "1 Main St",
                        line2: "Suite 2",
                        city: "Austin",
                        state: "TX",
                        postal_code: "78701",
                        country: "US",
                    },
                },
            },
        });
        expect(sdk.createPayment.mock.calls[0]?.[0]).not.toHaveProperty("customer_details");
        controller.deactivate();
    });

    it("presents the amount remaining net of in-flight payments, not a client formula", async () => {
        // total 5000 at 3%, nothing collected, a $20.00 payment still processing:
        // the server says 3150 remain for Apple Pay.
        sdk.get.mockResolvedValueOnce(
            session({
                total: 5000,
                amount_collected: 0,
                amount_remaining: 3000,
                dual_pricing: { rate: 3, amount_remaining: 3150 },
                payment_method_types: ["apple_pay"],
                payments: [],
                currency: "USD",
            } as any),
        );
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        await controller.prepareApplePay();
        controller.setWalletAvailability("apple_pay", "available");
        expect(controller.beginApplePayPresentation()).toMatchObject({ amount: 3150 });
        controller.cancelWalletPresentation("apple_pay");
        controller.deactivate();
    });

    it("does not present Apple Pay while nothing remains to collect", async () => {
        sdk.get.mockResolvedValueOnce(
            session({
                total: 5000,
                amount_collected: 0,
                amount_remaining: 0,
                dual_pricing: { rate: 3, amount_remaining: 0 },
                payment_method_types: ["apple_pay"],
                payments: [],
                currency: "USD",
            } as any),
        );
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        await controller.prepareApplePay();
        controller.setWalletAvailability("apple_pay", "available");
        expect(controller.beginApplePayPresentation()).toBeNull();
        controller.deactivate();
    });

    it("presents the server's dual-pricing amount remaining on the Apple Pay sheet", async () => {
        const canonical = session({
            total: 2946,
            amount_remaining: 1946,
            amount_collected: 1000,
            dual_pricing: { rate: -2, amount_remaining: 1946 },
            payment_method_types: ["apple_pay"],
            payments: [],
            currency: "USD",
        } as any);
        sdk.get.mockResolvedValueOnce(canonical);
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        await controller.prepareApplePay();
        controller.setWalletAvailability("apple_pay", "available");

        expect(controller.beginApplePayPresentation()).toMatchObject({ amount: 1946 });
        controller.cancelWalletPresentation("apple_pay");
        canonical.updated_at++;
        canonical.dual_pricing = { rate: 3, amount_remaining: 2034 };
        controller.setWalletAvailability("apple_pay", "available");
        const presentation = controller.beginApplePayPresentation()!;
        expect(presentation.amount).toBe(2034);
        canonical.dual_pricing = { rate: 4, amount_remaining: 2064 };
        await expect(controller.authorizeApplePay(presentation, {} as any)).resolves.toBe(
            "failure",
        );
        expect(sdk.createPayment).not.toHaveBeenCalled();
        controller.deactivate();
    });

    it("keeps Apple Pay tokens out of public errors on a definite API failure", async () => {
        sdk.get.mockResolvedValueOnce(
            session({
                total: 1299,
                amount_remaining: 1299,
                amount_collected: 0,
                payment_method_types: ["apple_pay"],
                payments: [],
                currency: "USD",
            } as any),
        );
        sdk.createPayment.mockResolvedValueOnce({
            object: "error",
            error: {
                type: "payment_error",
                message: "Your card was declined.",
                customer_message: "Your card was declined.",
            },
        });
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        await controller.prepareApplePay();
        controller.setWalletAvailability("apple_pay", "available");
        const presentation = controller.beginApplePayPresentation()!;
        await expect(
            controller.authorizeApplePay(presentation, {
                version: "EC_v1",
                data: "opaque-data",
                signature: "signature",
                header: {
                    ephemeralPublicKey: "key",
                    publicKeyHash: "hash",
                    transactionId: "transaction",
                },
            }),
        ).resolves.toBe("failure");

        expect(controller.getPublicState()).toMatchObject({
            status: "failed",
            submissionError: {
                code: "payment_failed",
                message: "Your card was declined.",
            },
        });
        expect(JSON.stringify(controller.getPublicState())).not.toContain("opaque-data");
        controller.deactivate();
    });

    it("treats checkout totals conflicts as definite stale failures and refreshes before retry", async () => {
        const initial = session({
            total: 2000,
            amount_remaining: 2000,
            amount_collected: 0,
            payment_method_types: ["apple_pay"],
            payments: [],
            currency: "USD",
        } as any);
        sdk.get.mockResolvedValueOnce(initial).mockResolvedValueOnce(
            session({
                ...initial,
                updated_at: initial.updated_at + 1,
                total: 2200,
                amount_remaining: 2200,
            } as any),
        );
        sdk.createPayment.mockResolvedValueOnce({
            object: "error",
            error: {
                type: "invalid_request_error",
                code: "checkout_totals_changed",
                message: "provider payload must not be shown",
            },
        });
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        await controller.prepareApplePay();
        controller.setWalletAvailability("apple_pay", "available");
        const presentation = controller.beginApplePayPresentation()!;

        await expect(controller.authorizeApplePay(presentation, {} as any)).resolves.toBe(
            "failure",
        );
        expect(controller.getPublicState()).toMatchObject({
            status: "failed",
            submissionError: {
                message: "Checkout details changed. Review the updated total and try again.",
            },
        });
        expect(JSON.stringify(controller.getPublicState())).not.toContain("provider payload");
        await flush();
        await vi.waitFor(() =>
            expect(controller.getPublicState().walletAvailability.applePay).toBe("available"),
        );
        expect(sdk.get).toHaveBeenCalledTimes(2);
        expect(sdk.walletConfiguration).toHaveBeenCalledTimes(2);
        expect(controller.beginApplePayPresentation()).toMatchObject({
            updatedAt: initial.updated_at + 1,
            amount: 2200,
        });
        controller.deactivate();
    });

    it("keeps a processing Apple Pay outcome locked until its own payment succeeds", async () => {
        const canonical = session({
            total: 5000,
            amount_remaining: 5000,
            amount_collected: 0,
            payment_method_types: ["apple_pay"],
            payments: [{ id: "pay_existing", status: "succeeded" }] as any,
            currency: "USD",
        } as any);
        sdk.get.mockResolvedValueOnce(canonical);
        const onComplete = vi.fn();
        const controller = new BiasController({ clientSecret: "cs_1", onComplete });
        controller.activate();
        await flush();
        await controller.prepareApplePay();
        controller.setWalletAvailability("apple_pay", "available");
        const presentation = controller.beginApplePayPresentation()!;
        sdk.createPayment
            .mockRejectedValueOnce(new TypeError("network failed"))
            .mockResolvedValueOnce({ object: "payment", id: "pay_new", status: "processing" });
        sdk.get
            .mockResolvedValueOnce(
                session({
                    ...canonical,
                    updated_at: canonical.updated_at + 1,
                    payments: [
                        { id: "pay_existing", status: "succeeded" },
                        { id: "pay_new", status: "processing" },
                    ] as any,
                } as any),
            )
            .mockResolvedValueOnce(
                session({
                    ...canonical,
                    updated_at: canonical.updated_at + 2,
                    payments: [
                        { id: "pay_existing", status: "succeeded" },
                        { id: "pay_new", status: "succeeded" },
                    ] as any,
                } as any),
            );
        await expect(controller.authorizeApplePay(presentation, {} as any)).resolves.toBe(
            "ambiguous",
        );
        expect(controller.getPublicState()).toMatchObject({
            status: "submitting",
            canSubmit: false,
        });
        await new Promise((resolve) => setTimeout(resolve, 900));
        expect(controller.getPublicState().status).toBe("submitting");
        await vi.waitFor(() => expect(controller.getPublicState().status).toBe("succeeded"), {
            timeout: 2_000,
        });
        expect(sdk.createPayment).toHaveBeenCalledTimes(2);
        expectIdenticalReplays(sdk.createPayment.mock.calls);
        await new Promise((resolve) => setTimeout(resolve, 1_050));
        expect(onComplete).toHaveBeenCalledOnce();
        controller.deactivate();
    });

    it("settles an ambiguous Apple Pay attempt with its replayed answer, not other session payments", async () => {
        const canonical = session({
            total: 5000,
            amount_remaining: 5000,
            amount_collected: 0,
            payment_method_types: ["apple_pay"],
            payments: [{ id: "pay_existing", status: "succeeded" }] as any,
            currency: "USD",
        } as any);
        sdk.get.mockResolvedValueOnce(canonical).mockResolvedValue(
            session({
                ...canonical,
                updated_at: canonical.updated_at + 1,
                payments: [
                    { id: "pay_existing", status: "succeeded" },
                    {
                        id: "pay_other",
                        status: "failed",
                        payment_error: { message: "Someone else's card was declined." },
                    },
                ] as any,
            } as any),
        );
        sdk.createPayment
            .mockRejectedValueOnce(new TypeError("network failed"))
            .mockResolvedValueOnce({
                object: "error",
                error: {
                    type: "payment_error",
                    message: "The card was declined.",
                    customer_message: "The card was declined.",
                },
            });
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        await controller.prepareApplePay();
        controller.setWalletAvailability("apple_pay", "available");
        const presentation = controller.beginApplePayPresentation()!;

        await expect(controller.authorizeApplePay(presentation, {} as any)).resolves.toBe(
            "ambiguous",
        );
        await vi.waitFor(() =>
            expect(controller.getPublicState()).toMatchObject({
                status: "failed",
                submissionError: { message: "The card was declined." },
            }),
        );
        expectIdenticalReplays(sdk.createPayment.mock.calls);
        controller.deactivate();
    });

    it("keeps a non-final Apple Pay payment locked while it is followed on the session", async () => {
        const canonical = session({
            total: 5000,
            amount_remaining: 5000,
            amount_collected: 0,
            payment_method_types: ["apple_pay"],
            payments: [{ id: "pay_existing", status: "succeeded" }] as any,
            currency: "USD",
        } as any);
        let unrelatedUpdatedAt = canonical.updated_at;
        sdk.get.mockResolvedValueOnce(canonical).mockImplementation(async () =>
            session({
                ...canonical,
                updated_at: ++unrelatedUpdatedAt,
                payments: [
                    { id: "pay_existing", status: "succeeded" },
                    { id: "pay_new", status: "processing" },
                ] as any,
            } as any),
        );
        sdk.createPayment
            .mockRejectedValueOnce(new TypeError("network failed"))
            .mockResolvedValueOnce({ object: "payment", id: "pay_new", status: "processing" });
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        await controller.prepareApplePay();
        controller.setWalletAvailability("apple_pay", "available");
        const presentation = controller.beginApplePayPresentation()!;

        await controller.authorizeApplePay(presentation, {} as any);
        await new Promise((resolve) => setTimeout(resolve, 1_850));
        expect(controller.getPublicState()).toMatchObject({
            status: "submitting",
            canSubmit: false,
        });
        // Beyond the initial load, the payment is read back from the session.
        expect(sdk.get.mock.calls.length).toBeGreaterThan(1);
        expect(sdk.createPayment).toHaveBeenCalledTimes(2);
        controller.deactivate();
    });

    it("settles an ambiguous Apple Pay attempt once a replay reaches the API", async () => {
        const canonical = session({
            total: 5000,
            amount_remaining: 5000,
            amount_collected: 0,
            payment_method_types: ["apple_pay"],
            payments: [{ id: "pay_existing", status: "succeeded" }] as any,
            currency: "USD",
        } as any);
        sdk.get.mockResolvedValueOnce(canonical);
        sdk.createPayment
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockResolvedValueOnce({
                object: "error",
                error: {
                    type: "payment_error",
                    message: "The card was declined.",
                    customer_message: "The card was declined.",
                },
            });
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        await controller.prepareApplePay();
        controller.setWalletAvailability("apple_pay", "available");
        const presentation = controller.beginApplePayPresentation()!;

        await expect(controller.authorizeApplePay(presentation, {} as any)).resolves.toBe(
            "ambiguous",
        );
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(controller.getPublicState().status).toBe("submitting");
        await vi.waitFor(
            () =>
                expect(controller.getPublicState()).toMatchObject({
                    status: "failed",
                    submissionError: {
                        code: "payment_failed",
                        retryable: true,
                        message: "The card was declined.",
                    },
                }),
            { timeout: 3_000 },
        );
        expect(sdk.createPayment).toHaveBeenCalledTimes(3);
        expectIdenticalReplays(sdk.createPayment.mock.calls);
        // The wallet can be presented again for a retry.
        expect(controller.beginApplePayPresentation()).not.toBeNull();
        controller.deactivate();
    });

    it("rejects merchant validation API errors without leaking their payload into public state", async () => {
        sdk.get.mockResolvedValueOnce(
            session({
                total: 5000,
                amount_remaining: 5000,
                amount_collected: 0,
                payment_method_types: ["apple_pay"],
                currency: "USD",
            } as any),
        );
        sdk.merchantSession.mockResolvedValueOnce({
            object: "error",
            error: { message: "validation rejected" },
        });
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        await controller.prepareApplePay();
        controller.setWalletAvailability("apple_pay", "available");
        const presentation = controller.beginApplePayPresentation()!;
        await expect(
            controller.validateApplePayMerchant(presentation, "https://apple.example/validate"),
        ).rejects.toMatchObject({ code: "payment_failed" });
        controller.failApplePayPresentation("Apple Pay could not be validated.");
        expect(controller.getPublicState()).toMatchObject({
            status: "failed",
            submissionError: { message: "Apple Pay could not be validated." },
        });
        expect(JSON.stringify(controller.getPublicState())).not.toContain("apple.example");
        controller.deactivate();
    });

    it("scopes secure-frame coordination to one checkout instance", () => {
        const first = new BiasController({ clientSecret: "cs_1" });
        const second = new BiasController({ clientSecret: "cs_1" });
        const group = first.getFrame("cardNumber").group;
        expect(group).toMatch(/^[A-Za-z0-9-]{8,128}$/);
        expect(first.getFrame("cardCvc").group).toBe(group);
        expect(second.getFrame("cardNumber").group).not.toBe(group);
    });

    it("gives secure frames a new key when the API base changes", () => {
        const controller = new BiasController({ clientSecret: "cs_1", apiBaseUrl: "https://a" });
        const before = controller.getFrame("cardNumber").key;
        controller.updateConfig({ clientSecret: "cs_1", apiBaseUrl: "https://b" });
        expect(controller.getFrame("cardNumber").key).not.toBe(before);
    });
});

describe("BiasController preview", () => {
    const previewSession = (overrides: Partial<CheckoutSession> = {}) =>
        session({ client_secret: "preview", payment_method_types: ["card"], ...overrides });

    beforeEach(() => {
        vi.mocked(detectGeoLocation).mockClear();
    });

    it("shows the configured session as ready without making any requests", async () => {
        const initialCheckoutSession = previewSession();
        const controller = new BiasController({
            clientSecret: "preview",
            preview: true,
            initialCheckoutSession,
        });
        controller.registerCollector({ kind: "contact", fields: ["email"] });
        controller.registerCollector({
            kind: "address",
            scope: "billing",
            fields: ["addressLine1", "city", "state", "postalCode", "country"],
        });
        controller.activate();
        expect(controller.getPublicState()).toMatchObject({
            sessionState: { status: "ready", session: initialCheckoutSession },
            paymentMethod: "card",
        });

        controller.getField("email").setValue("shopper@example.com");
        controller.getField("addressLine1").setValue("1 Market St");
        controller.getField("city").setValue("San Francisco");
        controller.getField("state").setValue("CA");
        controller.getField("postalCode").setValue("94105");
        for (const field of ["cardNumber", "cardExpiry", "cardCvc"] as const) {
            controller.getFrame(field).setEncryptedData("enc");
        }
        controller.refreshSession();
        await expect(controller.applyDiscountCode("SAVE10")).resolves.toBe(false);
        await expect(controller.prepareApplePay()).resolves.toBeNull();
        await expect(controller.verifyAddress("billing")).resolves.toBeNull();
        await expect(
            controller.autocompleteAddress("1 Market", "US", new AbortController().signal),
        ).resolves.toEqual([]);
        controller.submit();
        await new Promise((resolve) => setTimeout(resolve, 450));

        expect(controller.getPublicState()).toMatchObject({
            sessionState: { status: "ready", session: initialCheckoutSession },
            detailsSaveState: { status: "saved" },
            status: "idle",
            submissionError: null,
        });
        expect(sdk.calls).toEqual([]);
        expect(fetch).not.toHaveBeenCalled();
        expect(detectGeoLocation).not.toHaveBeenCalled();
        expect(controller.getFrame("cardNumber").preview).toBe(true);
        controller.deactivate();
    });

    it("requires an initial checkout session", () => {
        const controller = new BiasController({ clientSecret: "preview", preview: true });
        controller.activate();
        expect(controller.getPublicState().sessionState).toMatchObject({
            status: "error",
            error: { code: "configuration_error" },
        });
        expect(sdk.calls).toEqual([]);
    });

    it("shows a later initial checkout session in place of the first", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const controller = new BiasController({
            clientSecret: "preview",
            preview: true,
            initialCheckoutSession: previewSession(),
        });
        controller.activate();
        const next = previewSession({ total: 7_500, amount_remaining: 7_500 });
        controller.updateConfig({
            clientSecret: "preview",
            preview: true,
            initialCheckoutSession: next,
        });
        await flush();

        expect(controller.getPublicState().sessionState).toEqual({
            status: "ready",
            session: next,
        });
        expect(warn).not.toHaveBeenCalled();
        expect(sdk.calls).toEqual([]);
        warn.mockRestore();
        controller.deactivate();
    });
});

describe("BiasController agreements", () => {
    const terms =
        "By subscribing, you agree to be automatically charged $40.00 every month until you cancel. You can cancel anytime.";

    async function enterCard(controller: BiasController) {
        controller.activate();
        await flush();
        controller.getField("postalCode").setValue("94110");
        for (const field of ["cardNumber", "cardExpiry", "cardCvc"] as const) {
            controller.getFrame(field).setEncryptedData("enc");
        }
    }

    async function enterBankAccount(controller: BiasController) {
        controller.activate();
        await flush();
        controller.getField("name").setValue("Ada Lovelace");
        controller.getField("postalCode").setValue("94110");
        for (const field of ["bankAccountNumber", "bankRoutingNumber"] as const) {
            controller.getFrame(field).setEncryptedData("enc");
        }
    }

    function paymentParams() {
        return sdk.createPayment.mock.calls[0]![0] as Record<string, unknown>;
    }

    it("pays a subscription checkout, which agrees to the terms it shows", async () => {
        sdk.get.mockResolvedValue(session({ mode: "subscription", subscription_terms: terms }));
        const controller = new BiasController({ clientSecret: "cs_1" });
        await enterCard(controller);
        controller.submit();
        await flush();

        expect(sdk.createPayment).toHaveBeenCalledTimes(1);
        expect(paymentParams()).not.toHaveProperty("mandate_data");
        controller.deactivate();
    });

    it("starts a free trial with a $0 payment pinned to the displayed session", async () => {
        const trial = session({
            mode: "subscription",
            updated_at: 7,
            total: 0,
            amount_remaining: 0,
            subscription_terms: terms,
        });
        sdk.get.mockResolvedValue(trial);
        sdk.update.mockResolvedValue(trial);
        const controller = new BiasController({ clientSecret: "cs_1" });
        await enterCard(controller);
        expect(controller.getPublicState().canSubmit).toBe(true);
        controller.submit();
        await flush();

        expect(paymentParams()).toMatchObject({ amount: 0, checkout_session_updated_at: 7 });
        expect(controller.getPublicState().submissionError).toBeNull();
        controller.deactivate();
    });

    it("authorizes debits from a bank account that will pay a subscription invoice's renewals", async () => {
        sdk.get.mockResolvedValue(
            session({
                subscription_terms: terms,
                payment_method_types: ["us_bank_account"],
                mandate_text: "I authorize Example to debit my account.",
            } as Partial<CheckoutSession>),
        );
        const controller = new BiasController({ clientSecret: "cs_1" });
        await enterBankAccount(controller);
        controller.submit();
        await flush();

        expect(paymentParams()).toMatchObject({
            mandate_data: { customer_acceptance: { type: "online" } },
        });
        controller.deactivate();
    });

    it("refreshes the session and explains when the terms changed before the payment", async () => {
        sdk.get.mockResolvedValue(session({ mode: "subscription", subscription_terms: terms }));
        sdk.createPayment.mockResolvedValueOnce({
            object: "error",
            error: {
                type: "invalid_request_error",
                code: "checkout_totals_changed",
                message:
                    "The checkout session's renewal terms changed. Show the customer its updated 'subscription_terms' and confirm again.",
                param: "subscription_terms",
            },
        });
        const controller = new BiasController({ clientSecret: "cs_1" });
        await enterCard(controller);
        controller.submit();
        await flush();
        await flush();

        expect(controller.getPublicState()).toMatchObject({
            status: "failed",
            submissionError: { code: "payment_failed" },
        });
        expect(controller.getPublicState().submissionError?.message).toBe(
            "The subscription terms changed. Review them and try again.",
        );
        expect(sdk.get).toHaveBeenCalledTimes(2);
        controller.deactivate();
    });

    it("accepts the shown debit authorization when saving a new bank account", async () => {
        sdk.get.mockResolvedValue(
            session({
                mode: "setup",
                payment_method_types: ["us_bank_account"],
                mandate_text: "I authorize Example to debit my account.",
            } as Partial<CheckoutSession>),
        );
        const controller = new BiasController({ clientSecret: "cs_1" });
        await enterBankAccount(controller);
        controller.submit();
        await flush();

        expect(paymentParams()).toMatchObject({
            mandate_data: { customer_acceptance: { type: "online" } },
            payment_method: { us_bank_account: { account_holder_type: "individual" } },
        });
        controller.deactivate();
    });

    it("authorizes a company account's debits with the session's company text", async () => {
        sdk.get.mockResolvedValue(
            session({
                mode: "setup",
                payment_method_types: ["us_bank_account"],
                mandate_text: "I authorize Example to debit my account.",
                company_mandate_text: "I authorize Example to debit my company's account.",
            } as Partial<CheckoutSession>),
        );
        const controller = new BiasController({ clientSecret: "cs_1" });
        await enterBankAccount(controller);
        controller.getField("accountHolderType").setValue("company");
        controller.submit();
        await flush();

        expect(paymentParams()).toMatchObject({
            mandate_data: { customer_acceptance: { type: "online" } },
            payment_method: { us_bank_account: { account_holder_type: "company" } },
        });
        controller.deactivate();
    });

    it("sends no debit authorization for a bank payment that doesn't save the account", async () => {
        sdk.get.mockResolvedValue(
            session({
                payment_method_types: ["us_bank_account"],
                mandate_text: null,
            } as Partial<CheckoutSession>),
        );
        const controller = new BiasController({ clientSecret: "cs_1" });
        await enterBankAccount(controller);
        controller.submit();
        await flush();

        expect(sdk.createPayment).toHaveBeenCalledTimes(1);
        expect(paymentParams()).not.toHaveProperty("mandate_data");
        controller.deactivate();
    });
});
