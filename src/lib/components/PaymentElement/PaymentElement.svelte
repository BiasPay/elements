<script lang="ts">
    import type { Appearance } from "~/core";
    import { getBiasContext } from "~/context.svelte";
    import { appearance as appearanceAction } from "~/utils/appearance";
    import PaymentMethodList from "../PaymentMethodList/PaymentMethodList.svelte";
    import FormError from "../FormError/FormError.svelte";
    import { filterSupportedPaymentMethods } from "../PaymentMethodList/paymentMethods.ts";

    type Props = {
        paymentMethodLayout?: "tabs" | "radio";
        appearance?: Appearance;
    };

    let { paymentMethodLayout = "tabs", appearance }: Props = $props();

    const ctx = getBiasContext();

    $effect(() => ctx.registerPaymentElement());

    const paymentMethods = $derived(
        filterSupportedPaymentMethods(ctx.checkoutSession?.payment_method_types ?? ["card"]),
    );
    const paymentError = $derived(ctx.snapshot.paymentError);
</script>

{#if !ctx.sessionLoading}
    <div class="bias-payment-form 🔒 bias:min-w-60 bias:w-full bias:flex bias:flex-col bias:gap-(--bias-gap)" use:appearanceAction={appearance}>
        <div>
            <PaymentMethodList listStyle={paymentMethodLayout} {paymentMethods} {appearance} />
            <FormError message={paymentError} standalone />
        </div>
    </div>
{/if}
