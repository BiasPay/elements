<script lang="ts">
    import FrameField from "../Field/FrameField.svelte";

    type Props = {
        id?: string;
        placeholder?: string;
    };

    let { id, placeholder }: Props = $props();
</script>

<FrameField
    fieldType="bankAccountNumber"
    class="bias-accountNumber"
    {id}
    placeholder={placeholder ?? "000123456789"}
/>
