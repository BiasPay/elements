<script lang="ts">
    import { mandateText, type Appearance } from "~/core";
    import { getAddressScope, getBiasContext } from "~/context.svelte";
    import { appearance as appearanceAction } from "~/utils/appearance";
    import CountrySelect from "../Field/CountrySelect.svelte";
    import PostalCodeInput from "../Field/PostalCodeInput.svelte";
    import FieldGroup from "../FieldGroup/FieldGroup.svelte";
    import Row from "../Row/Row.svelte";
    import SameAsShippingToggle from "~/components/SameAsShippingToggle/SameAsShippingToggle.svelte";
    import AccountNumberInput from "./AccountNumberInput.svelte";
    import AccountHolderTypeSelect from "./AccountHolderTypeSelect.svelte";
    import AccountTypeSelect from "./AccountTypeSelect.svelte";
    import NameInput from "../Field/NameInput.svelte";
    import RoutingNumberInput from "./RoutingNumberInput.svelte";

    type Props = {
        appearance?: Appearance;
        /** @internal PaymentElement owns the shared surface registration. */
        registerSurface?: boolean;
    };

    let { appearance, registerSurface = true }: Props = $props();

    const ctx = getBiasContext();
    $effect(() =>
        registerSurface ? ctx.registerPaymentElement("us_bank_account") : undefined,
    );
    const scope = $derived(getAddressScope());

    /**
     * Match the card form's billing behavior: when shipping is collected and
     * no separate billing address element is mounted, offer to reuse shipping.
     */
    const showSameAsShipping = $derived(
        ctx.snapshot.collectsShipping && !ctx.snapshot.collectsAddress,
    );
    const sameAsShipping = $derived(showSameAsShipping && ctx.snapshot.billingSameAsShipping);
    const fs = $derived(ctx.fieldState);
    const metadata = $derived(ctx.addressMetadata(scope));
    /** Saving a new bank account accepts this authorization for later debits. */
    const authorization = $derived(
        mandateText(ctx.checkoutSession, fs.accountHolderType?.value ?? "individual"),
    );
    /** The holder picks which authorization the customer accepts, so it's asked when saving. */
    const savesAccount = $derived(mandateText(ctx.checkoutSession) !== null);

    function handleSameAsShippingChange(detail: { checked: boolean }) {
        ctx.setBillingSameAsShipping(detail.checked);
    }
</script>

<div class="bias-form 🔒 bias:flex bias:flex-col bias:gap-(--bias-gap)" use:appearanceAction={appearance}>
    <FieldGroup label="Full name" fieldType="name" {appearance} error={fs.name.error}>
        {#snippet input(placeholder, id)}
            <NameInput {id} placeholder={placeholder ?? "John doe"} />
        {/snippet}
    </FieldGroup>

    {#if savesAccount}
        <FieldGroup label="Account holder" fieldType="accountHolderType" {appearance}>
            {#snippet input(placeholder, id)}
                <AccountHolderTypeSelect {id} />
            {/snippet}
        </FieldGroup>
    {/if}

    <FieldGroup label="Account type" fieldType="accountType" {appearance}>
        {#snippet input(placeholder, id)}
            <AccountTypeSelect {id} />
        {/snippet}
    </FieldGroup>

    <FieldGroup
        label="Routing number"
        fieldType="bankRoutingNumber"
        {appearance}
        error={fs.bankRoutingNumber.error}
    >
        {#snippet input(placeholder, id, _ariaDescribedby, floatingLabelShrunk)}
            <RoutingNumberInput {id} {placeholder} {floatingLabelShrunk} />
        {/snippet}
    </FieldGroup>

    <FieldGroup
        label="Account number"
        fieldType="bankAccountNumber"
        {appearance}
        error={fs.bankAccountNumber.error}
    >
        {#snippet input(placeholder, id, _ariaDescribedby, floatingLabelShrunk)}
            <AccountNumberInput {id} {placeholder} {floatingLabelShrunk} />
        {/snippet}
    </FieldGroup>

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

                    {#if metadata.postalCode.used}
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
    {:else if !ctx.snapshot.collectsAddress}
        <Row>
            <FieldGroup label="Country" fieldType="country" {appearance} error={fs.country.error}>
                {#snippet input(placeholder, id)}
                    <CountrySelect {id} />
                {/snippet}
            </FieldGroup>

            {#if metadata.postalCode.used}
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
    {/if}

    {#if authorization}
        <p
            class="bias-mandateText 🔒 bias:m-0 bias:text-xs bias:leading-snug bias:whitespace-pre-line bias:text-muted-foreground"
        >
            {authorization}
        </p>
    {/if}
</div>
