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
    fieldType="cardExpiry"
    class="bias-cardExpiry"
    {id}
    {floatingLabelShrunk}
    placeholder={placeholder ?? "MM / YY"}
/>
