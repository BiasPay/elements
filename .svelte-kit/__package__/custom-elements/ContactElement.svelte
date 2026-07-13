<svelte:options customElement={{ shadow: "none" }} />

<script lang="ts">
    import type { Appearance } from "../core";
    import ContactElement from "../components/ContactElement/ContactElement.svelte";
    import { setupCustomElement } from "./setup";

    let { appearance }: { appearance?: Appearance } = $props();
    setupCustomElement($host());
</script>

<ContactElement {appearance} />
