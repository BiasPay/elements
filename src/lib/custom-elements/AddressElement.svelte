<svelte:options customElement={{
    shadow: "none",
    props: {
        scope: { type: "String" },
        collectPhone: { type: "Boolean", attribute: "collect-phone" },
    },
}} />

<script lang="ts">
    import type { AddressScope, Appearance } from "~/core";
    import AddressElement from "../components/AddressElement/AddressElement.svelte";
    import { setupCustomElement } from "./setup";

    let { scope = "billing", collectPhone = false, appearance }: {
        scope?: AddressScope;
        collectPhone?: boolean;
        appearance?: Appearance;
    } = $props();
    setupCustomElement($host());
</script>

<AddressElement {scope} {collectPhone} {appearance} />
