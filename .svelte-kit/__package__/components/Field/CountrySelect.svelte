<script lang="ts">
    import { getCountryOptions } from "../../core";
    import { getAddressScope, getBiasContext } from "../../context.svelte";
    import Select from "./Select.svelte";

    const options = getCountryOptions().map((option) => ({
        value: option.code,
        label: option.name,
    }));

    type Props = {
        id?: string;
    };

    let { id }: Props = $props();

    const ctx = getBiasContext();
    const scope = $derived(getAddressScope());

    const disabled = $derived(ctx.submitDisabled);
    const country = $derived(ctx.getField(scope, "country"));
</script>

<Select
    class="bias-country"
    {id}
    value={country.value}
    {options}
    {disabled}
    autocomplete="country"
    onchange={(value) => country.setValue(value)}
/>
