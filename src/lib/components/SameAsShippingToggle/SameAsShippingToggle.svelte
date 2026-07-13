<script lang="ts">
    import type { Snippet } from "svelte";
    import Checkbox from "../Checkbox/Checkbox.svelte";
    import { collapse, easeInOutSmooth } from "../../utils/transitions";

    type Props = {
        label: string;
        checked: boolean;
        onchange: (detail: { checked: boolean }) => void;
        /** Fields hidden while "same as shipping" is checked. */
        content: Snippet;
    };

    let { label, checked, onchange, content }: Props = $props();
</script>

<div class="bias-sameAsShippingGroup 🔒 bias:flex bias:flex-col">
    <Checkbox {label} {checked} {onchange} />
    {#if !checked}
        <div
            class="🔒 bias:pt-(--bias-gap) bias:flex bias:flex-col bias:gap-(--bias-gap)"
            transition:collapse={{ duration: 400, opacity: 0, translate: "0 8px", easing: easeInOutSmooth }}
        >
            {@render content()}
        </div>
    {/if}
</div>
