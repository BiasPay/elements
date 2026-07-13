<script lang="ts">
    import FrameField from "../Field/FrameField.svelte";

    type Props = {
        id?: string;
        placeholder?: string;
    };

    let { id, placeholder }: Props = $props();
</script>

<FrameField
    fieldType="bankRoutingNumber"
    class="bias-routingNumber"
    {id}
    placeholder={placeholder ?? "110000000"}
/>
