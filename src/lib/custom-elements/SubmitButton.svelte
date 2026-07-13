<svelte:options customElement={{
    shadow: "none",
    props: { disabled: { type: "Boolean" }, label: { type: "String" } },
}} />

<script lang="ts">
    import SubmitButton from "../components/SubmitButton/SubmitButton.svelte";
    import { setupCustomElement } from "./setup";

    let { disabled = false, label }: { disabled?: boolean; label?: string } = $props();
    setupCustomElement($host());
</script>

<SubmitButton {disabled} {label} />
