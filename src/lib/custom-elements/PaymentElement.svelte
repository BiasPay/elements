<svelte:options customElement={{
    shadow: "none",
    props: {
        paymentMethodLayout: { type: "String", attribute: "payment-method-layout" },
        savedPaymentMethodEmail: { type: "String", attribute: "saved-payment-method-email" },
        collectBillingName: { type: "Boolean", attribute: "collect-billing-name" },
        collectBillingAddress: { type: "Boolean", attribute: "collect-billing-address" },
    },
}} />

<script lang="ts">
    import type { Appearance } from "~/core";
    import PaymentElement from "../components/PaymentElement/PaymentElement.svelte";
    import { setupCustomElement } from "./setup";

    let {
        paymentMethodLayout = "tabs",
        savedPaymentMethodEmail,
        collectBillingName = false,
        collectBillingAddress = false,
        appearance,
    }: {
        paymentMethodLayout?: "tabs" | "radio";
        savedPaymentMethodEmail?: string;
        collectBillingName?: boolean;
        collectBillingAddress?: boolean;
        appearance?: Appearance;
    } = $props();

    setupCustomElement($host());
</script>

<PaymentElement
    {paymentMethodLayout}
    {savedPaymentMethodEmail}
    {collectBillingName}
    {collectBillingAddress}
    {appearance}
/>
