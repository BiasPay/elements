<script lang="ts">
    import { getAddressScope, getBiasContext } from "~/context.svelte";
    import Select from "../Field/Select.svelte";

    const OPTIONS = [
        { value: "individual", label: "Personal" },
        { value: "company", label: "Business" },
    ];

    type Props = {
        id?: string;
    };

    let { id }: Props = $props();

    const ctx = getBiasContext();
    const scope = $derived(getAddressScope());

    const disabled = $derived(ctx.submitDisabled);
    const field = $derived(ctx.getField(scope, "accountHolderType"));
</script>

<Select
    class="bias-accountHolderType"
    {id}
    value={field.value}
    options={OPTIONS}
    {disabled}
    onchange={(value) => field.setValue(value as "individual" | "company")}
/>
