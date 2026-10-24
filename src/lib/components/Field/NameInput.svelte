<script lang="ts">
    import { getAddressScope } from "~/context.svelte";
    import type { ValueFieldType } from "~/core";
    import { scopedAutocomplete } from "../AddressElement/autocomplete";
    import HostTextField from "./HostTextField.svelte";

    type Props = {
        fieldType?: Extract<ValueFieldType, "name" | "firstName" | "lastName">;
        id?: string;
        placeholder?: string;
    };

    let { fieldType = "name", id, placeholder }: Props = $props();

    const scope = $derived(getAddressScope());
    const autocomplete = $derived(
        scopedAutocomplete(
            scope,
            fieldType === "firstName"
                ? "given-name"
                : fieldType === "lastName"
                  ? "family-name"
                  : "name",
        ),
    );
</script>

<HostTextField
    {fieldType}
    class={`bias-${fieldType}`}
    {id}
    {autocomplete}
    placeholder={placeholder}
/>
