<script lang="ts">
    import type { FullAutoFill } from "svelte/elements";
    import HostTextField from "../Field/HostTextField.svelte";
    import type { AddressTextFieldType } from "./AddressInput.ts";

    const AUTOCOMPLETE: Record<AddressTextFieldType, FullAutoFill> = {
        addressLine1: "address-line1",
        addressLine2: "address-line2",
        city: "address-level2",
    };

    const CLASS_NAMES: Record<AddressTextFieldType, string> = {
        addressLine1: "bias-addressLine1",
        addressLine2: "bias-addressLine2",
        city: "bias-city",
    };

    type Props = {
        fieldType: AddressTextFieldType;
        id?: string;
        placeholder?: string;
    };

    let { fieldType, id, placeholder }: Props = $props();
</script>

<HostTextField
    {fieldType}
    class={CLASS_NAMES[fieldType]}
    {id}
    autocomplete={AUTOCOMPLETE[fieldType]}
    {placeholder}
/>
