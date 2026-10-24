import {
    Bias,
    type CheckoutSession,
    type CheckoutSessionCreateParams,
    type NonError,
} from "@biaspay/sdk";

export type SessionPreset = "default" | "dual-pricing" | "setup";

export type CreateDevSessionOptions = {
    preset: SessionPreset;
    paymentMethodTypes: ("card" | "us_bank_account")[];
    submitLabel: CheckoutSession["submit_label"];
};

export function buildSessionCreateParams(
    options: CreateDevSessionOptions,
    invoice?: string,
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

    if (invoice) {
        return { ...base, invoice, dual_pricing: { rate: 3 } };
    }

    return {
        ...base,
        line_items: [{ price_data: { name: "Dev order", unit_amount: 5000 }, quantity: 1 }],
    };
}

function unwrap<T extends { object: string; error?: { message: string } }>(result: T) {
    if (result.object === "error") throw new Error(result.error?.message);
    return result as NonError<T>;
}

async function createDevInvoice(sdk: Bias): Promise<string> {
    const customer = unwrap(
        await sdk.customers.create({ name: "Dev Customer", email: "dev@example.com" }),
    );
    const invoice = unwrap(
        await sdk.invoices.create({
            customer: customer.id,
            line_items: [{ price_data: { name: "Service", unit_amount: 10_000 }, quantity: 1 }],
        }),
    );
    return unwrap(await sdk.invoices.finalize(invoice.id)).id;
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

    const invoice = options.preset === "dual-pricing" ? await createDevInvoice(sdk) : undefined;
    const session = unwrap(
        await sdk.checkoutSessions.create(buildSessionCreateParams(options, invoice)),
    );
    return session.client_secret;
}
