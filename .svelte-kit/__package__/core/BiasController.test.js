import { beforeEach, describe, expect, it, vi } from "vitest";
import { BiasController } from "./BiasController";
vi.mock("./geo", () => ({ detectGeoLocation: vi.fn(async () => undefined) }));
vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503 })));
const sdk = vi.hoisted(() => ({
    get: vi.fn(),
    update: vi.fn(),
    createPayment: vi.fn(),
    calls: [],
}));
vi.mock("@biaspay/sdk", () => ({
    Bias: class {
        checkoutSessions = {
            get: (...args) => sdk.get(...args),
            update: (...args) => sdk.update(...args),
        };
        payments = { create: (...args) => sdk.createPayment(...args) };
        constructor(options) {
            sdk.calls.push(options);
        }
    },
}));
function session(overrides = {}) {
    return {
        object: "checkout_session",
        client_secret: "cs_1",
        payment_method_types: ["card", "us_bank_account"],
        customer_details: { email: null, name: null, phone: null },
        shipping_details: null,
        billing_details: null,
        payments: null,
        mode: "payment",
        ...overrides,
    };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
beforeEach(() => {
    sdk.calls.length = 0;
    sdk.get.mockReset().mockResolvedValue(session());
    sdk.update.mockReset().mockResolvedValue({ object: "checkout_session" });
    sdk.createPayment.mockReset().mockResolvedValue({ object: "payment" });
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
        expect(controller.getPublicState().paymentMethod).toBe("card");
        controller.deactivate();
        controller.deactivate();
        controller.activate();
        await flush();
        expect(sdk.get).toHaveBeenCalledTimes(2);
    });
    it("does not apply a stale response after deactivation", async () => {
        let resolve;
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
            .mockResolvedValueOnce(session({ client_secret: "cs_2", payment_method_types: ["us_bank_account"] }));
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
    it("validates an initial session before exposing it", () => {
        const controller = new BiasController({
            clientSecret: "cs_1",
            initialCheckoutSession: session({ client_secret: "someone_else" }),
        });
        controller.activate();
        expect(controller.getPublicState().sessionState).toMatchObject({
            status: "error",
            error: { code: "configuration_error", retryable: false },
        });
        expect(controller.getPublicState().paymentMethod).toBeUndefined();
        expect(sdk.get).not.toHaveBeenCalled();
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
        const seeded = new BiasController({
            clientSecret: "cs_1",
            initialCheckoutSession: session(),
        });
        seeded.activate();
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
        expect(() => controller.registerPaymentElement()).toThrowError(expect.objectContaining({ code: "configuration_error" }));
        unregister();
        expect(() => controller.registerPaymentElement("us_bank_account")).not.toThrow();
    });
    it("reference-counts disposable collectors", () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        const a = controller.registerCollector({ kind: "contact" });
        const b = controller.registerCollector({ kind: "contact" });
        controller.activate();
        a();
        controller.getField("email").setValue("person@example.com");
        expect(controller.getField("email").state.value).toBe("person@example.com");
        b();
    });
    it("loads normalized address metadata for an arbitrary country", async () => {
        let resolveFetch;
        const fetchMock = vi.fn(() => new Promise((resolve) => {
            resolveFetch = resolve;
        }));
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
        let rejectFetch;
        vi.stubGlobal("fetch", vi.fn(() => new Promise((_resolve, reject) => {
            rejectFetch = reject;
        })));
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
        expect(() => field.setValidator(() => ({ isValid: false, error: "bad" }))).toThrowError(expect.objectContaining({ code: "configuration_error" }));
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
    it("rejects unsupported payment methods with a warning", async () => {
        sdk.get.mockResolvedValue(session({ payment_method_types: ["card"] }));
        const controller = new BiasController({ clientSecret: "cs_1" });
        const warning = vi.spyOn(console, "warn").mockImplementation(() => { });
        controller.activate();
        await flush();
        controller.setPaymentMethod("us_bank_account");
        expect(controller.getPublicState().paymentMethod).toBe("card");
        expect(warning).toHaveBeenCalledWith(expect.stringContaining("not enabled"));
        warning.mockRestore();
    });
    it("deduplicates concurrent refreshes", async () => {
        let resolve;
        sdk.get.mockImplementation(() => new Promise((r) => (resolve = r)));
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        controller.refreshSession();
        controller.refreshSession();
        expect(sdk.get).toHaveBeenCalledTimes(1);
        resolve(session());
        await flush();
    });
    it("ignores a stale response after config identity changes", async () => {
        let resolveOld;
        sdk.get
            .mockImplementationOnce(() => new Promise((r) => (resolveOld = r)))
            .mockResolvedValueOnce(session({ client_secret: "cs_2", payment_method_types: ["us_bank_account"] }));
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        controller.updateConfig({ clientSecret: "cs_2" });
        await flush();
        resolveOld(session({ payment_method_types: ["card"] }));
        await flush();
        expect(controller.getPublicState().paymentMethod).toBe("us_bank_account");
    });
    it("ignores a later hydration seed for the same identity", async () => {
        const warning = vi.spyOn(console, "warn").mockImplementation(() => { });
        const first = session({
            customer_details: { email: "first@example.com", name: null, phone: null },
        });
        const controller = new BiasController({
            clientSecret: "cs_1",
            initialCheckoutSession: first,
        });
        controller.registerCollector({ kind: "contact" });
        controller.activate();
        controller.updateConfig({ clientSecret: "cs_1", initialCheckoutSession: session() });
        expect(controller.getField("email").state.value).toBe("first@example.com");
        expect(warning).toHaveBeenCalledWith(expect.stringContaining("ignored"));
        warning.mockRestore();
    });
    it("reports no supported runtime methods as a terminal configuration error", async () => {
        sdk.get.mockResolvedValue(session({ payment_method_types: ["wire"] }));
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
        for (const field of ["cardNumber", "cardExpiry", "cardCvc"]) {
            controller.getFrame(field).setEncryptedData("enc");
        }
        let resolvePaymentSession;
        sdk.get.mockImplementationOnce(() => new Promise((r) => (resolvePaymentSession = r)));
        controller.submit();
        await flush();
        controller.getField("postalCode").setValue("10001");
        expect(controller.getField("postalCode").state.value).toBe("94110");
        resolvePaymentSession(session());
        await flush();
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
    it("keeps submission frozen until an ambiguous frame change is reconciled", async () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        controller.getField("postalCode").setValue("94110");
        for (const field of ["cardNumber", "cardExpiry", "cardCvc"]) {
            controller.getFrame(field).setEncryptedData("enc");
        }
        let resolveCreateRead;
        sdk.get.mockImplementationOnce(() => new Promise((r) => (resolveCreateRead = r)));
        controller.submit();
        await flush();
        sdk.get.mockResolvedValueOnce(session({ payments: [] }));
        controller.updateConfig({ clientSecret: "cs_1", frameUrl: "https://other.example" });
        expect(controller.getPublicState()).toMatchObject({
            status: "submitting",
            canSubmit: false,
        });
        await flush();
        expect(controller.getPublicState()).toMatchObject({
            status: "failed",
            submissionError: { code: "payment_failed" },
        });
        resolveCreateRead(session());
    });
    it("reconciles an existing payment without issuing another create", async () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        controller.activate();
        await flush();
        controller.getField("postalCode").setValue("94110");
        for (const field of ["cardNumber", "cardExpiry", "cardCvc"]) {
            controller.getFrame(field).setEncryptedData("enc");
        }
        sdk.get.mockImplementationOnce(() => new Promise(() => { }));
        controller.submit();
        await flush();
        sdk.get.mockResolvedValueOnce(session({ payments: [{}] }));
        controller.updateConfig({ clientSecret: "cs_1", frameUrl: "https://other.example" });
        await flush();
        expect(controller.getPublicState().status).toBe("succeeded");
        expect(sdk.createPayment).not.toHaveBeenCalled();
    });
    it("clears disposable registrations and listeners on deactivate", async () => {
        const controller = new BiasController({ clientSecret: "cs_1" });
        const dispose = vi.fn();
        controller.registerCollector({ kind: "contact" });
        controller.registerFrame({ field: "cardNumber", triggerValidation() { }, dispose });
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
            initialCheckoutSession: session(),
            onComplete: first,
        });
        controller.activate();
        controller.updateConfig({
            clientSecret: "cs_1",
            initialCheckoutSession: session(),
            onComplete: latest,
        });
        controller.getField("postalCode").setValue("94110");
        for (const field of ["cardNumber", "cardExpiry", "cardCvc"])
            controller.getFrame(field).setEncryptedData("enc");
        controller.submit();
        await vi.runAllTimersAsync();
        expect(first).not.toHaveBeenCalled();
        expect(latest).toHaveBeenCalledOnce();
        vi.useRealTimers();
    });
    it("warns and does nothing for inactive imperative operations", () => {
        const warning = vi.spyOn(console, "warn").mockImplementation(() => { });
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
    it("includes API-base ownership in the secure-frame key", () => {
        const controller = new BiasController({ clientSecret: "cs_1", apiBaseUrl: "https://a" });
        expect(controller.getFrame("cardNumber").key).toContain("https://a");
        controller.updateConfig({ clientSecret: "cs_1", apiBaseUrl: "https://b" });
        expect(controller.getFrame("cardNumber").key).toContain("https://b");
    });
});
