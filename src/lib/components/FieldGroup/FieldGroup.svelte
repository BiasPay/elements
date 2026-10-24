<script lang="ts">
    import type { Snippet } from "svelte";
    import {
        scopedField,
        type Appearance,
        type FrameFieldType,
        type ValueFieldType,
    } from "~/core";
    import { getAddressScope, getBiasContext } from "~/context.svelte";
    import FieldGroupBase from "./FieldGroupBase.svelte";

    type FieldType = FrameFieldType | ValueFieldType;
    const FRAME_FIELDS: FrameFieldType[] = [
        "cardNumber", "cardExpiry", "cardCvc", "bankRoutingNumber", "bankAccountNumber",
    ];

    type Props = {
        label: string;
        fieldType: FieldType;
        appearance?: Appearance;
        placeholder?: string;
        /** Error shown below the field, if any. Omit for fields that never carry one. */
        error?: string | null;
        /** Optional rich feedback rendered beneath the field. */
        feedback?: Snippet<[string]>;
        /** Builds the input with its placeholder, id, aria-describedby, and floating-label state. */
        input: Snippet<[string | undefined, string, string | undefined, boolean]>;
    };

    let { label, fieldType, appearance, placeholder, error, feedback, input }: Props = $props();

    const ctx = getBiasContext();
    const scope = $derived(getAddressScope());

    /** Frame field types never appear in `ValueFieldType`. */
    function isValueFieldType(type: FieldType): type is ValueFieldType {
        return !(FRAME_FIELDS as FieldType[]).includes(type);
    }

    const slot = $derived(
        isValueFieldType(fieldType) ? scopedField(fieldType, scope) : fieldType,
    );
    const field = $derived(ctx.fieldState[slot]);
    const filled = $derived(!("empty" in field ? field.empty : !field.value));
</script>

<FieldGroupBase
    {label}
    fieldName={slot}
    {filled}
    {appearance}
    {placeholder}
    {error}
    {feedback}
    {input}
/>
