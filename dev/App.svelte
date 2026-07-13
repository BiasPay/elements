<script lang="ts">
    import type { CheckoutSession } from "@biaspay/sdk";
    import type { LabelStyle, PaymentMethod } from "~/core";
    import "../src/lib/index.ts";
    import DevControls, { type DevView } from "./DevControls.svelte";
    import { createDevCheckoutSession, type SessionPreset } from "./createSession.ts";
    import { createMockSession } from "./mocks.ts";
    import { readPersisted, persistOnChange } from "./persistedState.svelte.ts";

    const useMockSession = !import.meta.env.VITE_BIAS_API_KEY;

    // Tweak-panel options persist across reloads; session status stays ephemeral.
    let view = $state(readPersisted<DevView>("view", "payment-form"));
    let labelStyle = $state(readPersisted<LabelStyle | undefined>("labelStyle", undefined));
    let addressEnabled = $state(readPersisted("addressEnabled", false));
    let shippingEnabled = $state(readPersisted("shippingEnabled", false));
    let collectPhone = $state(readPersisted("collectPhone", false));
    let listStyle = $state(readPersisted<"tabs" | "radio">("listStyle", "tabs"));
    let cardEnabled = $state(readPersisted("cardEnabled", true));
    let bankEnabled = $state(readPersisted("bankEnabled", true));
    let sessionPreset = $state(readPersisted<SessionPreset>("sessionPreset", "default"));
    let submitLabel = $state(
        readPersisted<NonNullable<CheckoutSession["submit_label"]>>("submitLabel", "pay"),
    );

    persistOnChange("view", () => view);
    persistOnChange("labelStyle", () => labelStyle);
    persistOnChange("addressEnabled", () => addressEnabled);
    persistOnChange("shippingEnabled", () => shippingEnabled);
    persistOnChange("collectPhone", () => collectPhone);
    persistOnChange("listStyle", () => listStyle);
    persistOnChange("cardEnabled", () => cardEnabled);
    persistOnChange("bankEnabled", () => bankEnabled);
    persistOnChange("sessionPreset", () => sessionPreset);
    persistOnChange("submitLabel", () => submitLabel);

    let clientSecret = $state<string | undefined>(undefined);
    let sessionLoading = $state(false);
    let sessionError = $state<string | undefined>(undefined);

    let sessionRequestId = 0;

    const paymentMethods = $derived.by((): PaymentMethod[] => {
        const methods: PaymentMethod[] = [];
        if (cardEnabled) methods.push("card");
        if (bankEnabled) methods.push("us_bank_account");
        return methods.length > 0 ? methods : ["card"];
    });

    const previewSession = $derived.by((): CheckoutSession => {
        const base = createMockSession({
            payment_method_types: paymentMethods,
            submit_label: submitLabel,
        });

        if (sessionPreset === "dual-pricing") {
            return createMockSession({
                ...base,
                amount: 10_000,
                dual_pricing: { rate: 3 },
            });
        }

        if (sessionPreset === "setup") {
            return createMockSession({
                ...base,
                mode: "setup",
                amount: 0,
                submit_label: "auto",
            });
        }

        return base;
    });

    async function refreshSession() {
        if (useMockSession) {
            clientSecret = previewSession.client_secret;
            sessionError = undefined;
            sessionLoading = false;
            return;
        }

        sessionLoading = true;
        sessionError = undefined;
        const requestId = ++sessionRequestId;

        try {
            const secret = await createDevCheckoutSession({
                preset: sessionPreset,
                paymentMethodTypes: paymentMethods,
                submitLabel,
            });
            if (requestId !== sessionRequestId) return;
            clientSecret = secret;
        } catch (error) {
            if (requestId !== sessionRequestId) return;
            clientSecret = undefined;
            sessionError = error instanceof Error ? error.message : "Failed to create checkout session";
        } finally {
            if (requestId === sessionRequestId) {
                sessionLoading = false;
            }
        }
    }

    $effect(() => {
        // Re-create the checkout session whenever inputs that affect its
        // shape change; reads inside are the effect's dependencies.
        void (cardEnabled, bankEnabled, sessionPreset, submitLabel);
        void refreshSession();
    });

    const appearance = $derived({ labelStyle });
</script>

<DevControls
    bind:view
    bind:labelStyle
    bind:listStyle
    bind:cardEnabled
    bind:bankEnabled
    bind:addressEnabled
    bind:shippingEnabled
    bind:collectPhone
    bind:sessionPreset
    bind:submitLabel
    {useMockSession}
    {sessionLoading}
    {sessionError}
/>

<main class="page">
    <div class="preview">
        {#if sessionLoading && !clientSecret}
            <p class="status">Creating checkout session…</p>
        {:else if sessionError && !clientSecret}
            <p class="error">{sessionError}</p>
        {:else if clientSecret}
            <bias-provider
                client-secret={clientSecret}
                initialCheckoutSession={useMockSession ? previewSession : undefined}
                {appearance}
            >
                <div class="form-stack">
                    {#if view === "address-form"}
                        <bias-address-element collect-phone={collectPhone || undefined}></bias-address-element>
                    {:else}
                        <bias-contact-element></bias-contact-element>
                        {#if shippingEnabled}
                            <h2 class="section-heading">Shipping address</h2>
                            <bias-address-element mode="shipping"></bias-address-element>
                        {/if}
                        {#if addressEnabled}
                            <h2 class="section-heading">Billing address</h2>
                            <bias-address-element></bias-address-element>
                        {/if}

                        {#if view === "card-form"}
                            <bias-card-element></bias-card-element>
                        {:else if view === "bank-account-form"}
                            <bias-us-bank-account-element></bias-us-bank-account-element>
                        {:else}
                            <bias-payment-element payment-method-layout={listStyle}></bias-payment-element>
                        {/if}

                        <bias-submit-button></bias-submit-button>
                    {/if}
                </div>
            </bias-provider>
        {/if}
    </div>
</main>

<style>
    .page {
        min-height: 100vh;
        display: flex;
        justify-content: center;
        padding: 4rem 1.5rem 2rem;
    }

    .preview {
        width: min(100%, 420px);
        display: flex;
        flex-direction: column;
        gap: 24px;
    }

    .form-stack {
        display: flex;
        flex-direction: column;
        gap: 24px;
    }

    .section-heading {
        margin: 0 0 -0.25rem 0;
        font-size: 1rem;
        font-weight: 500;
    }

    .preview .status,
    .preview .error {
        margin: 0;
        padding: 1rem;
        border-radius: 12px;
        font-size: 0.875rem;
        line-height: 1.5;
    }

    .preview .status {
        color: #374151;
        background: rgba(0, 0, 0, 0.03);
        border: 1px solid rgba(17, 24, 39, 0.08);
    }

    .preview .error {
        color: #991b1b;
        background: #fef2f2;
        border: 1px solid #fecaca;
    }

    @media (min-width: 720px) {
        .page {
            padding-right: 24rem;
        }
    }
</style>
