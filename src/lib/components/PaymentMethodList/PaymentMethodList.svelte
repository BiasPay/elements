<script lang="ts">
    import type { Appearance } from "~/core";
    import { getBiasContext } from "~/context.svelte";
    import { type PaymentMethod } from "./paymentMethods.ts";
    import PaymentMethodForm from "./PaymentMethodForm.svelte";
    import PaymentMethodTabList from "./PaymentMethodTabList.svelte";
    import PaymentMethodRadioList from "./PaymentMethodRadioList.svelte";

    type Props = {
        listStyle?: "tabs" | "radio";
        paymentMethods?: PaymentMethod[];
        appearance?: Appearance;
    };

    let { listStyle = "tabs", paymentMethods = [], appearance }: Props = $props();

    const ctx = getBiasContext();

    // If the selected method isn't in the list, fall back to the first available one.
    $effect(() => {
        const selected = ctx.snapshot.selectedPaymentMethod;
        const first = paymentMethods[0];
        const valid = first ? paymentMethods.includes(selected as PaymentMethod) : true;
        if (!valid && first) {
            ctx.setPaymentMethod(first);
        }
    });
</script>

{#if paymentMethods.length === 0}
    <p>
        There are no available payment methods. Please contact the person who sent this invoice.
    </p>
{:else if paymentMethods.length === 1}
    <PaymentMethodForm method={paymentMethods[0]} {appearance} />
{:else if listStyle === "radio"}
    <PaymentMethodRadioList {paymentMethods} {appearance} />
{:else}
    <PaymentMethodTabList {paymentMethods} {appearance} />
{/if}
