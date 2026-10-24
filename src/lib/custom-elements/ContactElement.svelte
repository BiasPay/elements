<svelte:options customElement={{
    shadow: "none",
    props: {
        collectEmail: { type: "Boolean", attribute: "collect-email" },
        collectPhone: { type: "Boolean", attribute: "collect-phone" },
    },
}} />

<script lang="ts">
    import type { Appearance } from "~/core";
    import ContactElement from "../components/ContactElement/ContactElement.svelte";
    import { setupCustomElement } from "./setup";

    let {
        appearance,
        readOnly = false,
        collectEmail = true,
        collectPhone = false,
    }: {
        appearance?: Appearance;
        readOnly?: boolean;
        collectEmail?: boolean;
        collectPhone?: boolean;
    } = $props();
    setupCustomElement($host());
</script>

<ContactElement {appearance} {readOnly} {collectEmail} {collectPhone} />
