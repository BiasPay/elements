<script lang="ts">
    import type { Appearance } from "../../core";
    import { getBiasContext } from "../../context.svelte";
    import { appearance as appearanceAction } from "../../utils/appearance";
    import FieldGroup from "../FieldGroup/FieldGroup.svelte";
    import Row from "../Row/Row.svelte";
    import CountrySelect from "../Field/CountrySelect.svelte";
    import PostalCodeInput from "../Field/PostalCodeInput.svelte";
    import SameAsShippingToggle from "../SameAsShippingToggle/SameAsShippingToggle.svelte";
    import CardNumberInput from "./CardNumberInput.svelte";
    import CardExpiryInput from "./CardExpiryInput.svelte";
    import CardCvcInput from "./CardCvcInput.svelte";

    type Props = {
        appearance?: Appearance;
        /** @internal PaymentElement owns the shared surface registration. */
        registerSurface?: boolean;
    };

    let { appearance, registerSurface = true }: Props = $props();

    const ctx = getBiasContext();

    $effect(() => (registerSurface ? ctx.registerPaymentElement("card") : undefined));

    /**
     * True when this form should offer to reuse the shipping address for
     * billing. Only relevant when no separate billing address element is
     * mounted — if one is, its own toggle governs the shared billing fields.
     */
    const showSameAsShipping = $derived(
        ctx.snapshot.collectsShipping && !ctx.snapshot.collectsAddress,
    );
    const sameAsShipping = $derived(showSameAsShipping && ctx.snapshot.billingSameAsShipping);
    const fs = $derived(ctx.fieldState);
    const metadata = $derived(ctx.addressMetadata("billing"));
    const collectsPostalCode = $derived(!ctx.snapshot.collectsAddress && metadata.postalCode.used);

    function handleSameAsShippingChange(detail: { checked: boolean }) {
        ctx.setBillingSameAsShipping(detail.checked);
    }
</script>

<div class="bias-form 🔒 bias:flex bias:flex-col bias:gap-(--bias-gap)" use:appearanceAction={appearance}>
    <FieldGroup label="Card number" fieldType="cardNumber" {appearance} error={fs.cardNumber.error}>
        {#snippet input(placeholder, id)}
            <CardNumberInput {id} {placeholder} />
        {/snippet}
    </FieldGroup>

    <Row>
        <FieldGroup
            label="Expiration"
            fieldType="cardExpiry"
            {appearance}
            error={fs.cardExpiry.error}
        >
            {#snippet input(placeholder, id)}
                <CardExpiryInput {id} {placeholder} />
            {/snippet}
        </FieldGroup>

        <FieldGroup
            label="Security code"
            fieldType="cardCvc"
            {appearance}
            error={fs.cardCvc.error}
        >
            {#snippet input(placeholder, id)}
                <CardCvcInput {id} {placeholder} />
            {/snippet}
        </FieldGroup>
    </Row>

    {#if showSameAsShipping}
        <SameAsShippingToggle
            label="Use shipping address as billing address"
            checked={sameAsShipping}
            onchange={handleSameAsShippingChange}
        >
            {#snippet content()}
                <Row>
                    <FieldGroup
                        label="Country"
                        fieldType="country"
                        {appearance}
                        error={fs.country.error}
                    >
                        {#snippet input(placeholder, id)}
                            <CountrySelect {id} />
                        {/snippet}
                    </FieldGroup>

                    {#if collectsPostalCode}
                        <FieldGroup
                            label={metadata.postalCode.label}
                            fieldType="postalCode"
                            {appearance}
                            error={fs.postalCode.error}
                        >
                            {#snippet input(placeholder, id)}
                                <PostalCodeInput {id} {placeholder} />
                            {/snippet}
                        </FieldGroup>
                    {/if}
                </Row>
            {/snippet}
        </SameAsShippingToggle>
    {/if}
</div>
