<svelte:options customElement={{ shadow: "none" }} />

<script lang="ts">
    import type { Appearance } from "~/core";
    import CardElement from "../components/CardElement/CardElement.svelte";
    import { setupCustomElement } from "./setup";

    let { appearance }: { appearance?: Appearance } = $props();
    setupCustomElement($host());
</script>

<CardElement {appearance} />
