<script lang="ts">
    import HostTextField from "./HostTextField.svelte";

    type Props = {
        id?: string;
        placeholder?: string;
    };

    let { id, placeholder }: Props = $props();
</script>

<HostTextField
    fieldType="name"
    class="bias-name"
    {id}
    autocomplete="name"
    placeholder={placeholder}
/>
