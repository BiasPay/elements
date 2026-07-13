<script lang="ts">
    import { getAddressScope, getBiasContext } from "../../context.svelte";
    import HostTextField from "../Field/HostTextField.svelte";
    import Select from "../Field/Select.svelte";

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

    // Countries with a known subdivision list render a <select>; others a free-text input.
    const options = $derived(
        metadata.state.options.map((option) => ({ value: option.key, label: option.name })),
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
        autocomplete="address-level1"
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
        autocomplete="address-level1"
        placeholder={placeholder ?? metadata.state.label}
    />
{/if}
