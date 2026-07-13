<svelte:options customElement={{ shadow: "none" }} />

<script lang="ts">
    import type { Appearance } from "~/core";
    import USBankAccountElement from "../components/USBankAccountElement/USBankAccountElement.svelte";
    import { setupCustomElement } from "./setup";

    let { appearance }: { appearance?: Appearance } = $props();
    setupCustomElement($host());
</script>

<USBankAccountElement {appearance} />
