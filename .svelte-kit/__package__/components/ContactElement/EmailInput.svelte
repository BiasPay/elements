<script lang="ts">
    import HostTextField from "../Field/HostTextField.svelte";

    type Props = {
        id?: string;
        placeholder?: string;
    };

    let { id, placeholder }: Props = $props();
</script>

<HostTextField
    fieldType="email"
    class="bias-email"
    {id}
    type="email"
    inputmode="email"
    autocomplete="email"
    placeholder={placeholder ?? "Email"}
/>
