<script lang="ts">
    import type { FullAutoFill, HTMLInputAttributes } from "svelte/elements";
    import type { ValueFieldType } from "../../core";
    import { getAddressScope, getBiasContext } from "../../context.svelte";
    import FieldShell from "./FieldShell.svelte";

    type Props = {
        fieldType: ValueFieldType;
        class: string;
        id?: string;
        placeholder?: string;
        type?: HTMLInputAttributes["type"];
        inputmode?: HTMLInputAttributes["inputmode"];
        autocomplete?: FullAutoFill;
    };

    let { fieldType, class: className, id, placeholder, type = "text", inputmode, autocomplete }: Props =
        $props();

    const ctx = getBiasContext();
    const scope = $derived(getAddressScope());

    const disabled = $derived(ctx.submitDisabled);
    const field = $derived(ctx.getField(scope, fieldType));
</script>

<FieldShell class={className} {disabled} focused={field.state.focused} error={field.state.error}>
    <input
        {id}
        data-bias-hostField
        class="bias-hostField"
        {type}
        {inputmode}
        {autocomplete}
        value={field.value}
        placeholder={placeholder ?? undefined}
        {disabled}
        aria-invalid={field.state.error ? "true" : undefined}
        oninput={(e) => {
            field.setState({ error: null });
            field.setValue((e.currentTarget as HTMLInputElement).value);
        }}
        onfocus={() => field.setState({ focused: true })}
        onblur={() => {
            field.setState({ focused: false });
            field.validate();
        }}
    />
</FieldShell>
