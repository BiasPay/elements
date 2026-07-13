<script lang="ts">
    import type { FrameFieldType } from "../../core";
    import { getBiasContext } from "../../context.svelte";
    import FieldShell from "./FieldShell.svelte";
    import FieldFrame from "./FieldFrame.svelte";

    type Props = {
        fieldType: FrameFieldType;
    };

    let { fieldType }: Props = $props();

    const ctx = getBiasContext();
    const f = $derived(ctx.fieldState[fieldType]);
</script>

<FieldShell focused={f.focused} error={f.error}>
    <FieldFrame {fieldType} />
</FieldShell>
