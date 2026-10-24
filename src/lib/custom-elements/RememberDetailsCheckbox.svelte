<svelte:options customElement={{
    shadow: "none",
    props: { checked: { type: "Boolean" }, disabled: { type: "Boolean" } },
}} />

<script lang="ts">
    import Checkbox from "../components/Checkbox/Checkbox.svelte";
    import { getBiasContext } from "../context.svelte";
    import { setupCustomElement } from "./setup";

    let {
        checked = false,
        disabled = false,
        onRememberDetailsChange,
    }: {
        checked?: boolean;
        disabled?: boolean;
        onRememberDetailsChange?: (checked: boolean) => void;
    } = $props();
    let displayedChecked = $state(false);

    $effect(() => {
        displayedChecked = checked;
    });

    function handleChange(next: boolean) {
        displayedChecked = next;
        onRememberDetailsChange?.(next);
    }

    setupCustomElement($host());
    const ctx = getBiasContext();
    const locked = $derived(ctx.publicState.status === "presenting_wallet" || ctx.submitDisabled);
</script>

<Checkbox
    label="Remember my details for faster checkout next time"
    checked={displayedChecked}
    {disabled}
    {locked}
    onchange={({ checked: next }) => handleChange(next)}
/>
