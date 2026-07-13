<script lang="ts">
    import {
        ADDRESS_VALUE_FIELDS,
        scopedField,
        type AddressScope,
        type Appearance,
        type ValueFieldType,
    } from "~/core";
    import { getBiasContext, setAddressScope } from "~/context.svelte";
    import { appearance as appearanceAction } from "~/utils/appearance";
    import SameAsShippingToggle from "~/components/SameAsShippingToggle/SameAsShippingToggle.svelte";
    import { collapse, easeInOutSmooth } from "~/utils/transitions";
    import FieldGroup from "../FieldGroup/FieldGroup.svelte";
    import Row from "../Row/Row.svelte";
    import CountrySelect from "../Field/CountrySelect.svelte";
    import PostalCodeInput from "../Field/PostalCodeInput.svelte";
    import NameInput from "../Field/NameInput.svelte";
    import AddressInput from "./AddressInput.svelte";
    import AddressAutocomplete from "./AddressAutocomplete.svelte";
    import StateInput from "./StateInput.svelte";
    import PhoneInput from "./PhoneInput.svelte";

    type Props = {
        collectPhone?: boolean;
        /** Whether the collected address is used for billing (default) or shipping. */
        scope?: AddressScope;
        appearance?: Appearance;
    };

    let { collectPhone = false, scope = "billing", appearance }: Props = $props();

    const ctx = getBiasContext();

    // This form provides its `mode` as the address scope for its whole subtree,
    // so descendant inputs read/write the scope's field slots. Context is set
    // once at init; each mode gets its own <AddressElement> instance.
    // svelte-ignore state_referenced_locally
    setAddressScope(() => scope);

    /**
     * Whether the rest of the address form is shown, beyond address line 1.
     * Revealed once the user picks a suggestion or leaves address line 1 with
     * a value the autocomplete couldn't resolve to a selection.
     */
    let expanded = $state(false);

    /** True when this billing form should offer to reuse the shipping address. */
    const showSameAsShipping = $derived(scope === "billing" && ctx.snapshot.collectsShipping);
    const sameAsShipping = $derived(showSameAsShipping && ctx.snapshot.billingSameAsShipping);
    const metadata = $derived(ctx.addressMetadata(scope));

    /** Error for a logical address field, resolved against this form's scope. */
    function err(type: ValueFieldType): string | null {
        return ctx.fieldState[scopedField(type, scope)].error;
    }

    function handleReveal() {
        expanded = true;
    }

    function handleSameAsShippingChange(detail: { checked: boolean }) {
        ctx.setBillingSameAsShipping(detail.checked);
    }

    /** True once any disclosed field already carries a value (e.g. a hydrated saved address). */
    function hasDisclosedContent(): boolean {
        const fields: ValueFieldType[] = ["addressLine2", "city", "postalCode"];
        return fields.some((type) => !!ctx.fieldState[scopedField(type, scope)].value);
    }

    /** True once any disclosed field carries a validation error (e.g. submit-time validation). */
    function hasDisclosedError(): boolean {
        const fields: ValueFieldType[] = ["addressLine2", "city", "state", "postalCode"];
        return fields.some((type) => !!ctx.fieldState[scopedField(type, scope)].error);
    }

    $effect(() => {
        const fields: ValueFieldType[] = collectPhone
            ? [...ADDRESS_VALUE_FIELDS, "phone"]
            : [...ADDRESS_VALUE_FIELDS];
        return ctx.registerCollector({ kind: "address", scope, fields });
    });

    // Reveal the rest of the form once a disclosed field carries a value or error.
    $effect(() => {
        if (!expanded && (hasDisclosedContent() || hasDisclosedError())) {
            expanded = true;
        }
    });
</script>

{#snippet nameField()}
    <FieldGroup label="Full name" fieldType="name" {appearance} error={err("name")}>
        {#snippet input(placeholder, id)}
            <NameInput {id} placeholder={placeholder ?? "First and last name"} />
        {/snippet}
    </FieldGroup>
{/snippet}

{#snippet phoneField()}
    {#if collectPhone}
        <FieldGroup label="Phone" fieldType="phone" {appearance} error={err("phone")}>
            {#snippet input(placeholder, id)}
                <PhoneInput {id} {placeholder} />
            {/snippet}
        </FieldGroup>
    {/if}
{/snippet}

{#snippet addressFields()}
    {@render nameField()}

    <FieldGroup label="Country" fieldType="country" {appearance} error={err("country")}>
        {#snippet input(placeholder, id)}
            <CountrySelect {id} />
        {/snippet}
    </FieldGroup>

    <FieldGroup
        label="Address"
        fieldType="addressLine1"
        {appearance}
        error={err("addressLine1")}
    >
        {#snippet input(placeholder, id)}
            <AddressAutocomplete
                {id}
                placeholder={placeholder ?? "Street address"}
                onreveal={handleReveal}
            />
        {/snippet}
    </FieldGroup>

    {#if expanded}
        <div transition:collapse={{ duration: 400, opacity: 0, translate: "0 16px", easing: easeInOutSmooth }}>
            <div class="bias-disclosureInner 🔒 bias:flex bias:flex-col bias:gap-(--bias-gap)">
                <FieldGroup
                    label="Address line 2"
                    fieldType="addressLine2"
                    {appearance}
                    error={err("addressLine2")}
                >
                    {#snippet input(placeholder, id)}
                        <AddressInput
                            fieldType="addressLine2"
                            {id}
                            placeholder={placeholder ?? "Apartment, suite, etc. (optional)"}
                        />
                    {/snippet}
                </FieldGroup>

                {#if metadata.city.used}
                    <FieldGroup label="City" fieldType="city" {appearance} error={err("city")}>
                        {#snippet input(placeholder, id)}
                            <AddressInput fieldType="city" {id} {placeholder} />
                        {/snippet}
                    </FieldGroup>
                {/if}

                {#if metadata.state.used || metadata.postalCode.used}
                    <Row>
                        {#if metadata.state.used}
                            <FieldGroup
                                label={metadata.state.label}
                                fieldType="state"
                                {appearance}
                                error={err("state")}
                            >
                                {#snippet input(placeholder, id)}
                                    <StateInput {id} {placeholder} />
                                {/snippet}
                            </FieldGroup>
                        {/if}
                        {#if metadata.postalCode.used}
                            <FieldGroup
                                label={metadata.postalCode.label}
                                fieldType="postalCode"
                                {appearance}
                                error={err("postalCode")}
                            >
                                {#snippet input(placeholder, id)}
                                    <PostalCodeInput {id} {placeholder} />
                                {/snippet}
                            </FieldGroup>
                        {/if}
                    </Row>
                {/if}
            </div>
        </div>
    {/if}
{/snippet}

{#if !ctx.sessionLoading}
    <div class="bias-form 🔒 bias:flex bias:flex-col bias:gap-(--bias-gap)" use:appearanceAction={appearance}>
        {#if !showSameAsShipping}
            {@render addressFields()}
        {:else}
            <SameAsShippingToggle
                label="Same as shipping address"
                checked={sameAsShipping}
                onchange={handleSameAsShippingChange}
            >
                {#snippet content()}
                    {@render addressFields()}
                {/snippet}
            </SameAsShippingToggle>
        {/if}
        {@render phoneField()}
    </div>
{/if}
