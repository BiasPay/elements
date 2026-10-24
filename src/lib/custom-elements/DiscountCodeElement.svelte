<svelte:options customElement={{ shadow: "none" }} />

<script lang="ts">
    import type { CheckoutSession } from "@biaspay/sdk";
    import type { Appearance } from "~/core";
    import DiscountCodeElement from "../components/DiscountCodeElement/DiscountCodeElement.svelte";
    import { setupCustomElement } from "./setup";

    let { appearance, onDiscountCodeChange }: {
        appearance?: Appearance;
        onDiscountCodeChange?: (session: CheckoutSession) => void | Promise<void>;
    } = $props();
    setupCustomElement($host());
</script>

<DiscountCodeElement {appearance} {onDiscountCodeChange} />
