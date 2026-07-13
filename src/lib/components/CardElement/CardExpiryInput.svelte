<script lang="ts">
    import FrameField from "../Field/FrameField.svelte";

    type Props = {
        id?: string;
        placeholder?: string;
    };

    let { id, placeholder }: Props = $props();
</script>

<FrameField
    fieldType="cardExpiry"
    class="bias-cardExpiry"
    {id}
    placeholder={placeholder ?? "MM / YY"}
/>
