<script lang="ts">
    import { onMount } from "svelte";
    import CardIcon from "./CardIcon.svelte";
    import type { CardBrand } from "./brands.ts";

    const brands: CardBrand[] = ["visa", "mastercard", "american-express", "discover"];

    type Props = {
        interval?: number;
    };

    let { interval = 2500 }: Props = $props();

    let index = $state(0);

    onMount(() => {
        const timer = setInterval(() => {
            index = (index + 1) % brands.length;
        }, interval);
        return () => clearInterval(timer);
    });
</script>

<CardIcon brand={brands[index]} />
