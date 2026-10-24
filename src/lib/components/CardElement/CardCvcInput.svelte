<script lang="ts">
    import FrameField from "../Field/FrameField.svelte";

    type Props = {
        id?: string;
        placeholder?: string;
        floatingLabelShrunk?: boolean;
    };

    let { id, placeholder, floatingLabelShrunk = false }: Props = $props();
</script>

<FrameField
    fieldType="cardCvc"
    class="bias-cardCvc"
    {id}
    {floatingLabelShrunk}
    placeholder={placeholder ?? "CVC"}
/>
