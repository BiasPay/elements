<script lang="ts">
    import type { Snippet } from "svelte";
    import type { FrameFieldType } from "../../core";
    import { getBiasContext } from "../../context.svelte";
    import FieldShell from "./FieldShell.svelte";
    import FieldFrame from "./FieldFrame.svelte";

    type Props = {
        fieldType: FrameFieldType;
        class: string;
        id?: string;
        placeholder?: string;
        /** Optional overlay rendered inside the frame (e.g. the card-brand icons). */
        children?: Snippet;
    };

    let { fieldType, class: className, id, placeholder, children }: Props = $props();

    const ctx = getBiasContext();
    const f = $derived(ctx.fieldState[fieldType]);
    const disabled = $derived(ctx.submitDisabled);
</script>

<FieldShell
    class={className}
    {disabled}
    focused={f.focused}
    error={f.error}
    dataFieldType={fieldType}
>
    <FieldFrame {fieldType} {placeholder} {id} />
    {@render children?.()}
</FieldShell>
