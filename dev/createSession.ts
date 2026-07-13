import { Bias, type CheckoutSession, type CheckoutSessionCreateParams } from "@biaspay/sdk";

export type SessionPreset = "default" | "dual-pricing" | "setup";

export type CreateDevSessionOptions = {
    preset: SessionPreset;
    paymentMethodTypes: ("card" | "us_bank_account")[];
    submitLabel: CheckoutSession["submit_label"];
};

export function buildSessionCreateParams(
    options: CreateDevSessionOptions,
): CheckoutSessionCreateParams {
    if (options.preset === "setup") {
        return {
            line_items: [],
            mode: "setup",
            submit_label: "auto",
            payment_method_types: options.paymentMethodTypes,
        };
    }

    const base: CheckoutSessionCreateParams = {
        mode: "payment",
        payment_method_types: options.paymentMethodTypes,
        submit_label: options.submitLabel,
    };

    if (options.preset === "dual-pricing") {
        return {
            ...base,
            amount: 10_000,
            dual_pricing: { rate: 3 },
        };
    }

    return {
        ...base,
        amount: 5000,
    };
}

export async function createDevCheckoutSession(options: CreateDevSessionOptions): Promise<string> {
    const apiKey = import.meta.env.VITE_BIAS_API_KEY;
    if (!apiKey) {
        throw new Error("VITE_BIAS_API_KEY is not set in dev/.env");
    }

    const sdk = new Bias({
        apiKey,
        baseURL: import.meta.env.VITE_BIAS_API_URL,
    });

    const result = await sdk.checkoutSessions.create(buildSessionCreateParams(options));
    if (result.object === "error") {
        throw new Error(result.error.message);
    }

    return result.client_secret;
}
