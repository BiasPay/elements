<script lang="ts">
    import type { Appearance } from "~/core";
    import { getBiasContext } from "~/context.svelte";
    import { appearance as appearanceAction } from "~/utils/appearance";

    import PaymentMethodList from "../PaymentMethodList/PaymentMethodList.svelte";
    import FormError from "../FormError/FormError.svelte";
    import { filterSupportedPaymentMethods } from "../PaymentMethodList/paymentMethods.ts";

    type Props = {
        paymentMethodLayout?: "tabs" | "radio";
        savedPaymentMethodEmail?: string;
        collectBillingName?: boolean;
        collectBillingAddress?: boolean;
        appearance?: Appearance;
    };

    let {
        paymentMethodLayout = "tabs",
        savedPaymentMethodEmail,
        collectBillingName = false,
        collectBillingAddress = false,
        appearance,
    }: Props = $props();

    const ctx = getBiasContext();

    $effect(() => ctx.registerPaymentElement());

    const sessionMethods = $derived(ctx.checkoutSession?.payment_method_types ?? ["card"]);
    const paymentMethods = $derived(filterSupportedPaymentMethods(sessionMethods));
    const hasApplePay = $derived(sessionMethods.includes("apple_pay"));
    const paymentError = $derived(ctx.snapshot.paymentError);
</script>

{#if !ctx.sessionLoading}
    <div class="bias-payment-form 🔒 bias:min-w-60 bias:w-full bias:flex bias:flex-col bias:gap-(--bias-gap)" use:appearanceAction={appearance}>
        <div class="bias:flex bias:flex-col bias:gap-(--bias-gap)">
            {#if paymentMethods.length > 0 || !hasApplePay}
                <PaymentMethodList
                    listStyle={paymentMethodLayout}
                    {paymentMethods}
                    savedPaymentMethods={ctx.snapshot.savedPaymentMethods}
                    {savedPaymentMethodEmail}
                    {collectBillingName}
                    {collectBillingAddress}
                    {appearance}
                />
            {/if}
            <FormError message={ctx.hasSubmitButton ? null : paymentError} standalone />
        </div>
    </div>
{/if}
