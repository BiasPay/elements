<script lang="ts">
    import { getBiasContext } from "../../context.svelte";
    import FrameField from "../Field/FrameField.svelte";
    import CardIconStack from "../CardIcon/CardIconStack.svelte";

    type Props = {
        id?: string;
        placeholder?: string;
    };

    let { id, placeholder }: Props = $props();

    const ctx = getBiasContext();
    const cardBrand = $derived(ctx.fieldState.cardNumber.cardBrand);
</script>

<FrameField
    fieldType="cardNumber"
    class="bias-cardNumber"
    {id}
    placeholder={placeholder ?? "1234 1234 1234 1234"}
>
    <CardIconStack {cardBrand} />
</FrameField>
