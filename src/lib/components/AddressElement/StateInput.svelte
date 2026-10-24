<script lang="ts">
    import { getAddressScope, getBiasContext } from "~/context.svelte";
    import HostTextField from "../Field/HostTextField.svelte";
    import Select from "../Field/Select.svelte";
    import { scopedAutocomplete } from "./autocomplete";

    type Props = {
        id?: string;
        placeholder?: string;
    };

    let { id, placeholder }: Props = $props();

    const ctx = getBiasContext();
    const scope = $derived(getAddressScope());

    const disabled = $derived(ctx.submitDisabled);
    const field = $derived(ctx.getField(scope, "state"));
    const metadata = $derived(ctx.addressMetadata(scope));
    const autocomplete = $derived(scopedAutocomplete(scope, "address-level1"));
    const armedForces = new Set(["AA", "AE", "AP"]);

    // Countries with a known subdivision list render a <select>; others a free-text input.
    const options = $derived(
        metadata.state.options
            .map((option) => ({ value: option.key, label: option.name }))
            .sort((a, b) => {
                if (metadata.country !== "US") return 0;
                return Number(armedForces.has(a.value)) - Number(armedForces.has(b.value));
            }),
    );
</script>

{#if options.length > 0}
    <Select
        class="bias-state"
        {id}
        value={field.value}
        {options}
        {disabled}
        error={!!field.state.error}
        {autocomplete}
        ariaLabel={metadata.state.label}
        placeholder={placeholder ?? metadata.state.label}
        onchange={(value) => {
            field.setState({ error: null });
            field.setValue(value);
        }}
    />
{:else}
    <HostTextField
        fieldType="state"
        class="bias-state"
        {id}
        {autocomplete}
        placeholder={placeholder ?? metadata.state.label}
    />
{/if}
