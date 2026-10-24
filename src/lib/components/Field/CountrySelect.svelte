<script lang="ts">
    import type { CountryCode } from "@biaspay/sdk";
    import { getCountryOptions } from "~/core";
    import { getAddressScope, getBiasContext } from "~/context.svelte";
    import {
        correctAllowedCountry,
        filterAllowedCountries,
    } from "../AddressElement/countries";
    import { scopedAutocomplete } from "../AddressElement/autocomplete";
    import Select from "./Select.svelte";

    const allOptions = getCountryOptions();

    type Props = {
        id?: string;
        allowedCountries?: CountryCode[];
    };

    let { id, allowedCountries }: Props = $props();

    const ctx = getBiasContext();
    const scope = $derived(getAddressScope());

    const disabled = $derived(ctx.submitDisabled);
    const country = $derived(ctx.getField(scope, "country"));
    const autocomplete = $derived(scopedAutocomplete(scope, "country"));
    const options = $derived(
        filterAllowedCountries(allOptions, allowedCountries)
            .map((option) => ({
                value: option.code,
                label: option.name,
            })),
    );

    $effect(() => {
        const corrected = correctAllowedCountry(country.value, allowedCountries);
        if (corrected !== country.value) country.setValue(corrected);
    });
</script>

<Select
    class="bias-country"
    {id}
    value={country.value}
    {options}
    {disabled}
    {autocomplete}
    ariaLabel="Country"
    onchange={(value) => country.setValue(value)}
/>
