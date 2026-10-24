<script lang="ts">
    import HostTextField from "../Field/HostTextField.svelte";

    type Props = {
        id?: string;
        placeholder?: string;
        readOnly?: boolean;
    };

    let { id, placeholder, readOnly }: Props = $props();
</script>

<HostTextField
    fieldType="email"
    class="bias-email"
    {id}
    {readOnly}
    type="email"
    inputmode="email"
    autocomplete="email"
    placeholder={placeholder ?? "Email"}
/>
