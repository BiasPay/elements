import type { ApplePayPaymentData } from "@biaspay/sdk";
import type {
    ApplePayContact,
    ApplePayPresentation,
    ApplePayPresentationUpdate,
    ApplePayShippingMethod,
} from "~/core";

export type ApplePayButtonType = "book" | "donate" | "pay" | "subscribe";

export type ApplePayLineItem = { label: string; amount: string; type: "final" };
export type ApplePayNativeShippingMethod = {
    identifier: string;
    label: string;
    detail: string;
    amount: string;
};

export type ApplePayPaymentRequest = {
    countryCode: string;
    currencyCode: string;
    merchantCapabilities: readonly string[];
    supportedNetworks: readonly string[];
    total: ApplePayLineItem;
    requiredBillingContactFields?: readonly ("name" | "postalAddress")[];
    requiredShippingContactFields?: readonly ("name" | "postalAddress" | "email" | "phone")[];
    shippingMethods?: readonly ApplePayNativeShippingMethod[];
};

export type ApplePayPaymentAuthorizedEvent = {
    payment: {
        token: { paymentData: ApplePayPaymentData };
        billingContact?: ApplePayContact;
        shippingContact?: ApplePayContact;
    };
};

export type ApplePayShippingContactSelectedEvent = { shippingContact: ApplePayContact };
export type ApplePayShippingMethodSelectedEvent = {
    shippingMethod: { identifier: string };
};

export type ApplePaySessionInstance = {
    onvalidatemerchant: ((event: { validationURL: string }) => void) | null;
    onpaymentauthorized: ((event: ApplePayPaymentAuthorizedEvent) => void) | null;
    onshippingcontactselected: ((event: ApplePayShippingContactSelectedEvent) => void) | null;
    onshippingmethodselected: ((event: ApplePayShippingMethodSelectedEvent) => void) | null;
    oncancel: (() => void) | null;
    begin(): void;
    abort(): void;
    completeMerchantValidation(merchantSession: Record<string, unknown>): void;
    completeShippingContactSelection(
        status: number,
        shippingMethods: readonly ApplePayNativeShippingMethod[],
        total: ApplePayLineItem,
        lineItems: readonly ApplePayLineItem[],
    ): void;
    completeShippingMethodSelection(
        status: number,
        total: ApplePayLineItem,
        lineItems: readonly ApplePayLineItem[],
    ): void;
    completePayment(result: number): void;
};

export type ApplePaySessionConstructor = {
    new (version: number, request: ApplePayPaymentRequest): ApplePaySessionInstance;
    readonly STATUS_SUCCESS: number;
    readonly STATUS_FAILURE: number;
    readonly STATUS_INVALID_SHIPPING_POSTAL_ADDRESS?: number;
    canMakePayments(): boolean;
    supportsVersion?(version: number): boolean;
};

declare global {
    var ApplePaySession: ApplePaySessionConstructor | undefined;
}

export function formatApplePayAmount(cents: number): string {
    if (!Number.isSafeInteger(cents) || cents < 0) {
        throw new RangeError("Apple Pay amount must be a non-negative integer number of cents.");
    }
    return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export function applePayTotal(
    presentation: Pick<ApplePayPresentation, "config">,
    amount: number,
): ApplePayLineItem {
    return {
        label: presentation.config.display_name,
        amount: formatApplePayAmount(amount),
        type: "final",
    };
}

export function nativeApplePayShippingMethods(
    methods: readonly ApplePayShippingMethod[],
): ApplePayNativeShippingMethod[] {
    return methods.map((method) => ({
        identifier: method.identifier,
        label: method.label,
        detail: method.detail,
        amount: formatApplePayAmount(method.amount),
    }));
}

export function nativeApplePayUpdate(
    presentation: ApplePayPresentation,
    update: ApplePayPresentationUpdate,
) {
    return {
        total: applePayTotal(presentation, update.amount),
        shippingMethods: nativeApplePayShippingMethods(update.shippingMethods),
        lineItems: [] as ApplePayLineItem[],
    };
}

export function buildApplePayRequest(presentation: ApplePayPresentation): ApplePayPaymentRequest {
    const { config } = presentation;
    const requiredShippingContactFields = [
        ...(presentation.requiresShippingContact ? (["name", "postalAddress"] as const) : []),
        ...(presentation.requiresEmail ? (["email"] as const) : []),
        ...(presentation.requiresPhone ? (["phone"] as const) : []),
    ];
    return {
        countryCode: config.country_code,
        currencyCode: config.currency_code,
        merchantCapabilities: [...config.merchant_capabilities],
        supportedNetworks: [...config.supported_networks],
        total: applePayTotal(presentation, presentation.amount),
        ...(presentation.requiresBillingContact
            ? { requiredBillingContactFields: ["name", "postalAddress"] as const }
            : {}),
        ...(requiredShippingContactFields.length > 0 ? { requiredShippingContactFields } : {}),
        ...(presentation.shippingMethods.length > 0
            ? { shippingMethods: nativeApplePayShippingMethods(presentation.shippingMethods) }
            : {}),
    };
}

export function applePayButtonType(
    submitLabel: string | undefined,
    mode: string | undefined,
): ApplePayButtonType {
    if (submitLabel === "book" || submitLabel === "donate" || submitLabel === "subscribe") {
        return submitLabel;
    }
    if (submitLabel === "pay" || (submitLabel === "auto" && mode !== "setup")) return "pay";
    return "pay";
}

const APPLE_PAY_VERSIONS = [6, 5, 4, 3] as const;
const APPLE_PAY_BASELINE_VERSION = 3;

export async function selectApplePaySessionVersion(): Promise<number | null> {
    await Promise.resolve();
    try {
        const ApplePay = globalThis.ApplePaySession;
        if (!ApplePay?.canMakePayments()) return null;
        if (!ApplePay.supportsVersion) return APPLE_PAY_BASELINE_VERSION;
        return APPLE_PAY_VERSIONS.find((version) => ApplePay.supportsVersion?.(version)) ?? null;
    } catch {
        return null;
    }
}
