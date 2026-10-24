<script lang="ts">
    import type { Appearance, SavedPaymentMethod } from "~/core";
    import { getBiasContext } from "~/context.svelte";
    import { type PaymentMethod } from "./paymentMethods.ts";
    import PaymentMethodForm from "./PaymentMethodForm.svelte";
    import PaymentMethodTabList from "./PaymentMethodTabList.svelte";
    import PaymentMethodRadioList from "./PaymentMethodRadioList.svelte";

    type Props = {
        listStyle?: "tabs" | "radio";
        paymentMethods?: PaymentMethod[];
        savedPaymentMethods?: readonly SavedPaymentMethod[];
        savedPaymentMethodEmail?: string;
        collectBillingName?: boolean;
        collectBillingAddress?: boolean;
        appearance?: Appearance;
    };

    const ctx = getBiasContext();
    let {
        listStyle = "tabs",
        paymentMethods = [],
        savedPaymentMethods = ctx.snapshot.savedPaymentMethods,
        savedPaymentMethodEmail,
        collectBillingName = false,
        collectBillingAddress = false,
        appearance,
    }: Props = $props();

    // If the selected method isn't in the list, fall back to the first available one.
    $effect(() => {
        if (ctx.snapshot.selectedSavedPaymentMethod) return;
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
{:else if paymentMethods.length === 1 && savedPaymentMethods.length === 0}
    <PaymentMethodForm method={paymentMethods[0]} {collectBillingName} {collectBillingAddress} {appearance} />
{:else if listStyle === "radio" || savedPaymentMethods.length > 0}
    <PaymentMethodRadioList
        {paymentMethods}
        {savedPaymentMethods}
        {savedPaymentMethodEmail}
        {collectBillingName}
        {collectBillingAddress}
        {appearance}
    />
{:else}
    <PaymentMethodTabList {paymentMethods} {collectBillingName} {collectBillingAddress} {appearance} />
{/if}
