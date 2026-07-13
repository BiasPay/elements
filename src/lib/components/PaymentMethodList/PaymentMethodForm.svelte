<script lang="ts">
    import type { Appearance } from "~/core";
    import type { PaymentMethod } from "./paymentMethods.ts";
    import CardElement from "../CardElement/CardElement.svelte";
    import USBankAccountElement from "../USBankAccountElement/USBankAccountElement.svelte";

    type Props = {
        method: PaymentMethod;
        appearance?: Appearance;
    };

    let { method, appearance }: Props = $props();
</script>

{#if method === "card"}
    <CardElement {appearance} registerSurface={false} />
{:else if method === "us_bank_account"}
    <USBankAccountElement {appearance} registerSurface={false} />
{/if}
