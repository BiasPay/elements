<script lang="ts">
    import type { Appearance } from "~/core";
    import type { PaymentMethod } from "./paymentMethods.ts";
    import AddressElement from "../AddressElement/AddressElement.svelte";
    import CardElement from "../CardElement/CardElement.svelte";
    import USBankAccountElement from "../USBankAccountElement/USBankAccountElement.svelte";

    type Props = {
        method: PaymentMethod;
        collectBillingName?: boolean;
        collectBillingAddress?: boolean;
        appearance?: Appearance;
    };

    let {
        method,
        collectBillingName = false,
        collectBillingAddress = false,
        appearance,
    }: Props = $props();
</script>

<div class="bias-paymentMethodForm 🔒 bias:flex bias:flex-col bias:gap-(--bias-gap)">
    {#if method === "card"}
        <CardElement {appearance} registerSurface={false} />
    {:else if method === "us_bank_account"}
        <USBankAccountElement {appearance} registerSurface={false} />
    {/if}

    {#if collectBillingName || collectBillingAddress}
        <div class="bias-billingDetails">
            <AddressElement
                scope="billing"
                collectName={collectBillingName}
                collectAddress={collectBillingAddress}
                {appearance}
            />
        </div>
    {/if}
</div>
