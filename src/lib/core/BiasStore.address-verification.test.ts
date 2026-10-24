import { afterEach, describe, expect, it, vi } from "vitest";
import type { CheckoutSession } from "@biaspay/sdk-checkout";
import { ADDRESS_VALUE_FIELDS, createBiasStore, type BiasStoreState } from "./BiasStore";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(value: unknown, status = 200) {
    return new Response(JSON.stringify(value), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function createStore() {
    const store = createBiasStore({
        clientSecret: () => "cs_test",
        onChange: vi.fn<(state: BiasStoreState) => void>(),
    });
    return store;
}

function fillAddress(store: ReturnType<typeof createStore>, scope: "billing" | "shipping") {
    if (scope === "shipping") {
        store.setFieldValue("shippingFirstName", "Jane");
        store.setFieldValue("shippingLastName", "Doe");
        store.setFieldValue("shippingCountry", "US");
        store.setFieldValue("shippingAddressLine1", "456 Main St");
        store.setFieldValue("shippingCity", "Calabasas");
        store.setFieldValue("shippingState", "CA");
        store.setFieldValue("shippingPostalCode", "91301");
        return;
    }

    store.setFieldValue("firstName", "Jane");
    store.setFieldValue("lastName", "Doe");
    store.setFieldValue("country", "US");
    store.setFieldValue("addressLine1", "123 Main St");
    store.setFieldValue("city", "Calabasas");
    store.setFieldValue("state", "CA");
    store.setFieldValue("postalCode", "91301");
}

function suggested(verdict: "suggestion" | "invalid", postalCode: string) {
    return {
        verdict,
        confidence: "high",
        suggested_address: {
            line1: "123 Main Street",
            line2: null,
            city: "Calabasas",
            state: "CA",
            postal_code: postalCode,
            country: "US",
        },
        reason: verdict === "invalid" ? "postal_region_mismatch" : "address_mismatch",
    };
}

function sessionWithSavedAddresses(): CheckoutSession {
    return {
        object: "checkout_session",
        id: "cs_test",
        live: false,
        created_at: 0,
        total: 1000,
        amount_collected: 0,
        dual_pricing: null,
        client_details: null,
        client_secret: "cs_test",
        customer: null,
        customer_details: { email: null, name: null, phone: null },
        shipping_details: {
            name: "Jane Doe",
            phone: null,
            address: {
                city: "Calabasas",
                country: "US",
                line1: "456 Main St",
                line2: null,
                postal_code: "91301",
                state: "CA",
            },
        },
        billing_details: {
            name: "Jane Doe",
            address: {
                city: "New York",
                country: "US",
                line1: "123 Main St",
                line2: null,
                postal_code: "10001",
                state: "NY",
            },
        },
        payments: null,
        invoice: null,
        line_items: null,
        metadata: {},
        mode: "payment",
        payment_method_types: ["card"],
        status: "open",
        submit_label: "pay",
    } as CheckoutSession;
}

afterEach(() => {
    fetchMock.mockReset();
    vi.useRealTimers();
});

describe("address verification", () => {
    it("validates saved billing and shipping addresses after hydration", async () => {
        const store = createStore();
        store.setAddressFields("billing", ADDRESS_VALUE_FIELDS);
        store.setAddressFields("shipping", ADDRESS_VALUE_FIELDS);
        fetchMock.mockImplementation(async (_url, init) => {
            const body = JSON.parse(String(init?.body));
            return jsonResponse(suggested("suggestion", body.state === "NY" ? "10002" : "91302"));
        });

        store.hydrateFromSession(sessionWithSavedAddresses());

        await vi.waitFor(() => {
            expect(store.getAddressVerification("billing")).toMatchObject({
                status: "verified",
                result: {
                    verdict: "suggestion",
                    suggested_address: { postal_code: "10002" },
                },
            });
            expect(store.getAddressVerification("shipping")).toMatchObject({
                status: "verified",
                result: {
                    verdict: "suggestion",
                    suggested_address: { postal_code: "91302" },
                },
            });
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        store.cancel();
    });

    it("skips remote validation for a locally malformed ZIP", async () => {
        const store = createStore();
        fillAddress(store, "billing");
        store.setFieldValue("postalCode", "1234");
        store.setAddressFields("billing", ADDRESS_VALUE_FIELDS);

        expect(await store.verifyAddress("billing")).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(store.getAddressVerification("billing")).toEqual({ status: "idle" });
    });

    it("keeps billing and shipping verdicts isolated", async () => {
        const store = createStore();
        fillAddress(store, "billing");
        fillAddress(store, "shipping");
        store.setAddressFields("billing", ADDRESS_VALUE_FIELDS);
        store.setAddressFields("shipping", ADDRESS_VALUE_FIELDS);
        fetchMock.mockImplementation(async (_url, init) => {
            const body = JSON.parse(String(init?.body));
            return jsonResponse(
                body.line1.startsWith("123")
                    ? suggested("suggestion", "91302")
                    : suggested("invalid", "10001"),
            );
        });

        await Promise.all([store.verifyAddress("billing"), store.verifyAddress("shipping")]);

        expect(store.getAddressVerification("billing")).toMatchObject({
            status: "verified",
            result: { verdict: "suggestion" },
        });
        expect(store.getAddressVerification("shipping")).toMatchObject({
            status: "verified",
            result: { verdict: "invalid" },
        });
        store.cancel();
    });

    it("discards a stale response after the scoped address changes", async () => {
        const store = createStore();
        fillAddress(store, "billing");
        store.setAddressFields("billing", ADDRESS_VALUE_FIELDS);
        let resolveFirst!: (response: Response) => void;
        const firstResponse = new Promise<Response>((resolve) => {
            resolveFirst = resolve;
        });
        fetchMock
            .mockImplementationOnce(async () => firstResponse)
            .mockImplementationOnce(async () => jsonResponse(suggested("suggestion", "91303")));

        const first = store.verifyAddress("billing");
        store.setFieldValue("postalCode", "91302");
        const second = store.verifyAddress("billing");
        await second;
        resolveFirst(jsonResponse(suggested("invalid", "10001")));
        await first;

        expect(store.getAddressVerification("billing")).toMatchObject({
            status: "verified",
            result: {
                verdict: "suggestion",
                suggested_address: { postal_code: "91303" },
            },
        });
        store.cancel();
    });

    it("keeps a remote invalid verdict non-blocking", async () => {
        const store = createStore();
        fillAddress(store, "billing");
        store.setAddressFields("billing", ADDRESS_VALUE_FIELDS);
        store.onEncryptedData("cardNumber", "number");
        store.onEncryptedData("cardExpiry", "expiry");
        store.onEncryptedData("cardCvc", "cvc");
        fetchMock.mockResolvedValue(jsonResponse(suggested("invalid", "91302")));

        await store.verifyAddress("billing");

        expect(store.getAddressVerification("billing")).toMatchObject({
            status: "verified",
            result: { verdict: "invalid" },
        });
        expect(store.isSubmittable()).toBe(true);
        store.cancel();
    });

    it("fails open when client-side verification times out", async () => {
        vi.useFakeTimers();
        const store = createStore();
        fillAddress(store, "billing");
        store.setAddressFields("billing", ADDRESS_VALUE_FIELDS);
        fetchMock.mockImplementation(
            async (_url, init) =>
                await new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener("abort", () => {
                        reject(new DOMException("Timed out", "AbortError"));
                    });
                }),
        );

        const verification = store.verifyAddress("billing");
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
        await vi.advanceTimersByTimeAsync(4_001);

        expect(await verification).toBeNull();
        expect(store.getAddressVerification("billing")).toEqual({ status: "idle" });
        expect(store.getState().fieldState.postalCode.valid).toBe(true);
        store.cancel();
    });

    it("waits for outstanding verification before submitting and then fails open", async () => {
        const store = createStore();
        fillAddress(store, "billing");
        store.setAddressFields("billing", ADDRESS_VALUE_FIELDS);
        store.onEncryptedData("cardNumber", "number");
        store.onEncryptedData("cardExpiry", "expiry");
        store.onEncryptedData("cardCvc", "cvc");
        let resolveVerification!: (response: Response) => void;
        fetchMock.mockImplementation(async (url) => {
            if (String(url).includes("/address/validate")) {
                return new Promise<Response>((resolve) => {
                    resolveVerification = resolve;
                });
            }
            return jsonResponse({
                object: "error",
                error: { type: "api_error", message: "stop after verification" },
            });
        });

        const verification = store.verifyAddress("billing");
        await vi.waitFor(() => {
            expect(resolveVerification).toBeTypeOf("function");
        });
        store.attemptPayment({ triggerFrameValidation: vi.fn() });
        await Promise.resolve();
        expect(
            fetchMock.mock.calls.some(([url]) => String(url).includes("checkout_sessions/current")),
        ).toBe(false);

        resolveVerification(jsonResponse(suggested("invalid", "91302")));
        await verification;
        await vi.waitFor(() => {
            expect(
                fetchMock.mock.calls.some(([url]) =>
                    String(url).includes("checkout_sessions/current"),
                ),
            ).toBe(true);
        });
        store.cancel();
    });
});
