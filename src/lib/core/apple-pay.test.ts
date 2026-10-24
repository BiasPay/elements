import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApplePayPresentation } from "./adapter";
import {
    applePayButtonType,
    buildApplePayRequest,
    formatApplePayAmount,
    selectApplePaySessionVersion,
} from "../components/ApplePay/apple-pay";

const presentation: ApplePayPresentation = {
    checkoutSessionId: "cs_test",
    updatedAt: 10,
    amount: 123456789,
    currency: "USD",
    requiresBillingContact: false,
    requiresEmail: false,
    requiresPhone: false,
    requiresShippingContact: false,
    shippingMethods: [],
    config: {
        enabled: true,
        country_code: "US",
        currency_code: "USD",
        supported_networks: ["visa", "masterCard"],
        merchant_capabilities: ["supports3DS"],
        display_name: "Bias Store",
    },
};

afterEach(() => vi.unstubAllGlobals());

describe("Apple Pay request helpers", () => {
    it("formats integer cents exactly without floating-point currency formatting", () => {
        expect(formatApplePayAmount(0)).toBe("0.00");
        expect(formatApplePayAmount(1)).toBe("0.01");
        expect(formatApplePayAmount(123456789)).toBe("1234567.89");
        expect(() => formatApplePayAmount(1.2)).toThrow(RangeError);
        expect(() => formatApplePayAmount(-1)).toThrow(RangeError);
    });

    it("builds the request from server configuration without shipping fields", () => {
        const request = buildApplePayRequest(presentation);
        expect(request).toEqual({
            countryCode: "US",
            currencyCode: "USD",
            merchantCapabilities: ["supports3DS"],
            supportedNetworks: ["visa", "masterCard"],
            total: { label: "Bias Store", amount: "1234567.89", type: "final" },
        });
        expect(request).not.toHaveProperty("requiredShippingContactFields");
        expect(request).not.toHaveProperty("shippingMethods");
    });

    it("requests billing name and postal address only when configured", () => {
        expect(
            buildApplePayRequest({ ...presentation, requiresBillingContact: true }),
        ).toMatchObject({
            requiredBillingContactFields: ["name", "postalAddress"],
        });
        expect(buildApplePayRequest(presentation)).not.toHaveProperty(
            "requiredBillingContactFields",
        );
    });

    it("requests express contact fields and formats canonical shipping methods", () => {
        expect(
            buildApplePayRequest({
                ...presentation,
                requiresEmail: true,
                requiresPhone: true,
                requiresShippingContact: true,
                shippingMethods: [
                    {
                        identifier: "shr_express",
                        label: "Express",
                        detail: "1–2 business days",
                        amount: 505,
                    },
                ],
            }),
        ).toMatchObject({
            requiredShippingContactFields: ["name", "postalAddress", "email", "phone"],
            shippingMethods: [
                {
                    identifier: "shr_express",
                    label: "Express",
                    detail: "1–2 business days",
                    amount: "5.05",
                },
            ],
        });
    });

    it("selects the highest supported version and uses a safe baseline for older browsers", async () => {
        const supportsVersion = vi.fn((version: number) => version <= 5);
        vi.stubGlobal("ApplePaySession", {
            canMakePayments: () => true,
            supportsVersion,
        });
        await expect(selectApplePaySessionVersion()).resolves.toBe(5);

        vi.stubGlobal("ApplePaySession", { canMakePayments: () => true });
        await expect(selectApplePaySessionVersion()).resolves.toBe(3);
    });

    it("returns unavailable when payment or every supported version is unavailable", async () => {
        vi.stubGlobal("ApplePaySession", { canMakePayments: () => false });
        await expect(selectApplePaySessionVersion()).resolves.toBeNull();
        vi.stubGlobal("ApplePaySession", {
            canMakePayments: () => true,
            supportsVersion: () => false,
        });
        await expect(selectApplePaySessionVersion()).resolves.toBeNull();
    });

    it("maps accessible submit intents and falls back to pay", () => {
        expect(applePayButtonType("book", "payment")).toBe("book");
        expect(applePayButtonType("donate", "payment")).toBe("donate");
        expect(applePayButtonType("subscribe", "payment")).toBe("subscribe");
        expect(applePayButtonType("auto", "setup")).toBe("pay");
    });
});
