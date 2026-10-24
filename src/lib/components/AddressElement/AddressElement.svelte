<script lang="ts">
    import { onDestroy } from "svelte";
    import type { CountryCode } from "@biaspay/sdk";
    import {
        ADDRESS_VALUE_FIELDS,
        scopedField,
        type AddressScope,
        type Appearance,
        type ValueFieldType,
    } from "~/core";
    import { getBiasContext, setAddressScope } from "~/context.svelte";
    import { appearance as appearanceAction } from "~/utils/appearance";
    import { cn } from "~/utils/classes";
    import SameAsShippingToggle from "~/components/SameAsShippingToggle/SameAsShippingToggle.svelte";
    import FieldGroup from "../FieldGroup/FieldGroup.svelte";
    import FieldFeedback from "../FieldFeedback/FieldFeedback.svelte";
    import Row from "../Row/Row.svelte";
    import CountrySelect from "../Field/CountrySelect.svelte";
    import PostalCodeInput from "../Field/PostalCodeInput.svelte";
    import NameInput from "../Field/NameInput.svelte";
    import AddressInput from "./AddressInput.svelte";
    import AddressAutocomplete from "./AddressAutocomplete.svelte";
    import StateInput from "./StateInput.svelte";
    import PhoneInput from "./PhoneInput.svelte";

    const FIELD_FEEDBACK_DELAY_MS = 500;

    type Props = {
        collectName?: boolean;
        collectAddress?: boolean;
        collectPhone?: boolean;
        /** Whether the collected address is used for billing (default) or shipping. */
        scope?: AddressScope;
        allowedCountries?: CountryCode[];
        appearance?: Appearance;
    };

    let {
        collectName = true,
        collectAddress = true,
        collectPhone = false,
        scope = "billing",
        allowedCountries,
        appearance,
    }: Props = $props();

    const ctx = getBiasContext();

    // This form provides its scope for its whole subtree, so descendant inputs
    // read/write the scope's field slots. Context is set once at init; each scope
    // gets its own <AddressElement> instance.
    // svelte-ignore state_referenced_locally
    setAddressScope(() => scope);

    /**
     * Whether the rest of the address form is shown, beyond address line 1.
     * Revealed once the user picks a suggestion or leaves address line 1 with
     * a value the autocomplete couldn't resolve to a selection.
     */
    let expanded = $state(false);
    let feedbackReady = $state(false);
    let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
    let registeredCollectorKey: string | undefined;
    let unregisterCollector: (() => void) | undefined;

    /** True when this billing form should offer to reuse the shipping address. */
    const showSameAsShipping = $derived(
        scope === "billing" && collectAddress && ctx.snapshot.collectsShipping,
    );
    const sameAsShipping = $derived(showSameAsShipping && ctx.snapshot.billingSameAsShipping);
    /** A name-only billing form defers to the payment form's "same as shipping" toggle. */
    const nameFromShipping = $derived(
        scope === "billing" &&
            !collectAddress &&
            ctx.snapshot.collectsShipping &&
            ctx.snapshot.billingSameAsShipping,
    );
    const metadata = $derived(ctx.addressMetadata(scope));
    const verification = $derived(ctx.addressVerification(scope));
    const postalFeedback = $derived(
        verification.status === "verified" &&
            (verification.result.verdict === "suggestion" ||
                verification.result.verdict === "invalid") &&
            verification.result.suggested_address?.postal_code
            ? verification.result
            : null,
    );
    const suggestedPostalCode = $derived(postalFeedback?.suggested_address?.postal_code ?? null);
    const suggestedStateName = $derived.by(() => {
        const state =
            postalFeedback?.suggested_address?.state ??
            ctx.fieldState[scopedField("state", scope)].value;
        return metadata.state.options.find(
            ({ key, name }) => key.toLowerCase() === state?.toLowerCase() || name === state,
        )?.name;
    });

    /** Error for a logical address field, resolved against this form's scope. */
    function err(type: ValueFieldType): string | null {
        return ctx.fieldState[scopedField(type, scope)].error;
    }

    function handleReveal() {
        expanded = true;
        feedbackReady = false;
        clearTimeout(feedbackTimer);
        feedbackTimer = setTimeout(() => {
            feedbackReady = true;
        }, FIELD_FEEDBACK_DELAY_MS);
    }

    function handleDisclosureFocus() {
        if (!expanded) handleReveal();
    }

    function handleSameAsShippingChange(detail: { checked: boolean }) {
        ctx.setBillingSameAsShipping(detail.checked);
    }

    function acceptSuggestedPostalCode() {
        if (!suggestedPostalCode) return;
        const postalCode = ctx.getField(scope, "postalCode");
        postalCode.setValue(suggestedPostalCode);
        postalCode.validate();
        void ctx.verifyAddress(scope);
    }

    /** True once any disclosed field already carries a value (e.g. a hydrated saved address). */
    function hasDisclosedContent(): boolean {
        const line1 = ctx.fieldState[scopedField("addressLine1", scope)];
        if (line1.value && !line1.focused) return true;

        const fields: ValueFieldType[] = ["addressLine2", "city", "postalCode"];
        return fields.some((type) => !!ctx.fieldState[scopedField(type, scope)].value);
    }

    /** True once any disclosed field carries a validation error (e.g. submit-time validation). */
    function hasDisclosedError(): boolean {
        const fields: ValueFieldType[] = ["addressLine2", "city", "state", "postalCode"];
        return fields.some((type) => !!ctx.fieldState[scopedField(type, scope)].error);
    }

    $effect(() => {
        const collectsShippingPhone = scope === "shipping" && collectPhone;
        const fields: ValueFieldType[] = [
            ...ADDRESS_VALUE_FIELDS.filter((field) =>
                field === "firstName" || field === "lastName" ? collectName : collectAddress,
            ),
            ...(collectsShippingPhone ? (["shippingPhone"] as const) : []),
        ];
        const key = `${scope}:${collectName}:${collectAddress}:${collectsShippingPhone}`;
        if (registeredCollectorKey === key) return;
        unregisterCollector?.();
        unregisterCollector = ctx.registerCollector({ kind: "address", scope, fields });
        registeredCollectorKey = key;
    });

    // Reveal the rest of the form once a disclosed field carries a value or error.
    $effect(() => {
        if (!expanded && (hasDisclosedContent() || hasDisclosedError())) {
            handleReveal();
        }
    });

    onDestroy(() => {
        clearTimeout(feedbackTimer);
        unregisterCollector?.();
    });
</script>

{#snippet nameField()}
    <Row>
        <FieldGroup
            label="First name"
            fieldType="firstName"
            {appearance}
            error={err("firstName")}
        >
            {#snippet input(placeholder, id)}
                <NameInput fieldType="firstName" {id} {placeholder} />
            {/snippet}
        </FieldGroup>
        <FieldGroup
            label="Last name"
            fieldType="lastName"
            {appearance}
            error={err("lastName")}
        >
            {#snippet input(placeholder, id)}
                <NameInput fieldType="lastName" {id} {placeholder} />
            {/snippet}
        </FieldGroup>
    </Row>
{/snippet}

{#snippet postalFieldFeedback(id: string)}
    {#if postalFeedback && suggestedPostalCode}
        <FieldFeedback
            {id}
            variant={postalFeedback.verdict === "invalid" ? "error" : "advisory"}
        >
            {#if postalFeedback.verdict === "invalid"}
                Enter a valid ZIP code{suggestedStateName ? ` for ${suggestedStateName}` : ""}.
            {/if}
            Did you mean
            <button
                type="button"
                class="bias-postalSuggestion 🔒 bias:m-0 bias:p-0 bias:border-0 bias:bg-transparent bias:text-inherit bias:font-[inherit] bias:underline bias:underline-offset-2 bias:cursor-pointer"
                onclick={acceptSuggestedPostalCode}
            >{suggestedPostalCode}</button>?
        </FieldFeedback>
    {/if}
{/snippet}

{#snippet phoneField()}
    {#if scope === "shipping" && collectPhone}
        <FieldGroup
            label="Phone"
            fieldType="shippingPhone"
            {appearance}
            error={err("shippingPhone")}
        >
            {#snippet input(placeholder, id)}
                <PhoneInput {id} {placeholder} />
            {/snippet}
        </FieldGroup>
    {/if}
{/snippet}

{#snippet addressFields()}
    {#if collectName}
        {@render nameField()}
    {/if}

    <FieldGroup label="Country" fieldType="country" {appearance} error={err("country")}>
        {#snippet input(placeholder, id)}
            <CountrySelect {id} {allowedCountries} />
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

    <!-- Keep autofill fields mounted; the grid track provides the disclosure height animation. -->
    <div
        class={cn(
            "bias-disclosure 🔒 bias:grid bias:transition-[grid-template-rows,translate,opacity,margin-bottom] bias:duration-[400ms] bias:ease-(--ease-in-out-smooth)",
            expanded
                ? "bias:grid-rows-[1fr] bias:opacity-100 bias:translate-y-0 bias:mb-0"
                : "bias:grid-rows-[0fr] bias:opacity-0 bias:translate-y-4 bias:-mb-(--bias-gap) bias:pointer-events-none",
        )}
        data-expanded={expanded ? "" : undefined}
        onfocusin={handleDisclosureFocus}
    >
        <div class="bias-disclosureInner 🔒 bias:min-h-0 bias:flex bias:flex-col bias:gap-(--bias-gap)">
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
                            feedback={feedbackReady && postalFeedback ? postalFieldFeedback : undefined}
                        >
                            {#snippet input(placeholder, id, ariaDescribedby)}
                                <PostalCodeInput
                                    {id}
                                    {placeholder}
                                    {ariaDescribedby}
                                    invalid={postalFeedback?.verdict === "invalid"}
                                />
                            {/snippet}
                        </FieldGroup>
                    {/if}
                </Row>
            {/if}
        </div>
    </div>
{/snippet}

{#if !ctx.sessionLoading}
    <div class="bias-form 🔒 bias:flex bias:flex-col bias:gap-(--bias-gap)" use:appearanceAction={appearance}>
        {#if !collectAddress}
            {#if collectName && !nameFromShipping}
                {@render nameField()}
            {/if}
        {:else if !showSameAsShipping}
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
