<svelte:options customElement={{
    shadow: "none",
    props: { paymentMethodLayout: { type: "String", attribute: "payment-method-layout" } },
}} />

<script lang="ts">
    import type { Appearance } from "../core";
    import PaymentElement from "../components/PaymentElement/PaymentElement.svelte";
    import { setupCustomElement } from "./setup";

    let { paymentMethodLayout = "tabs", appearance }: {
        paymentMethodLayout?: "tabs" | "radio";
        appearance?: Appearance;
    } = $props();

    setupCustomElement($host());
</script>

<PaymentElement {paymentMethodLayout} {appearance} />
