<svelte:options customElement={{
    shadow: "none",
    props: {
        disabled: { type: "Boolean" },
        showSeparator: { type: "Boolean", attribute: "show-separator" },
    },
}} />

<script lang="ts">
    import type { Appearance } from "~/core";
    import ExpressCheckoutElement from "../components/ExpressCheckoutElement/ExpressCheckoutElement.svelte";
    import { setupCustomElement } from "./setup";

    let {
        disabled = false,
        showSeparator = false,
        appearance,
    }: {
        disabled?: boolean;
        showSeparator?: boolean;
        appearance?: Appearance;
    } = $props();

    setupCustomElement($host());
</script>

<ExpressCheckoutElement {disabled} {showSeparator} {appearance} />
