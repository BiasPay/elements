<script lang="ts">
    import { getAddressScope, getBiasContext } from "../../context.svelte";
    import Select from "../Field/Select.svelte";

    const OPTIONS = [
        { value: "checking", label: "Checking" },
        { value: "savings", label: "Savings" },
    ];

    type Props = {
        id?: string;
    };

    let { id }: Props = $props();

    const ctx = getBiasContext();
    const scope = $derived(getAddressScope());

    const disabled = $derived(ctx.submitDisabled);
    const field = $derived(ctx.getField(scope, "accountType"));
</script>

<Select
    class="bias-accountType"
    {id}
    value={field.value}
    options={OPTIONS}
    {disabled}
    onchange={(value) => field.setValue(value as "checking" | "savings")}
/>
