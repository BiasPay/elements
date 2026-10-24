<script lang="ts">
    import { getBiasContext } from "~/context.svelte";
    import FrameField from "../Field/FrameField.svelte";
    import CardIconStack from "../CardIcon/CardIconStack.svelte";

    type Props = {
        id?: string;
        placeholder?: string;
        floatingLabelShrunk?: boolean;
    };

    let { id, placeholder, floatingLabelShrunk = false }: Props = $props();

    const ctx = getBiasContext();
    const cardBrand = $derived(ctx.fieldState.cardNumber.cardBrand);
</script>

<FrameField
    fieldType="cardNumber"
    class="bias-cardNumber"
    {id}
    {floatingLabelShrunk}
    placeholder={placeholder ?? "1234 1234 1234 1234"}
>
    <CardIconStack {cardBrand} />
</FrameField>
