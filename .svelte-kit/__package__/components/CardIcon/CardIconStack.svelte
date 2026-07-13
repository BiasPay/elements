<script lang="ts">
    import { onMount, untrack } from "svelte";
    import { fade } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import type { TransitionConfig } from "svelte/transition";
    import type { CardBrand } from "./brands.js";
    import CardIcon from "./CardIcon.svelte";
    import RotatingCardIcon from "./RotatingCardIcon.svelte";

    type Props = {
        cardBrand?: string | null;
    };

    let { cardBrand = null }: Props = $props();

    type StackEntry = { brand: string | null; id: number };

    let nextId = 0;
    let stack = $state<StackEntry[]>(untrack(() => [{ brand: cardBrand, id: nextId++ }]));
    let prevBrand: string | null = untrack(() => cardBrand);
    let mounted = $state(false);

    onMount(() => {
        mounted = true;
    });

    // Replace the single stacked entry whenever the brand changes; the keyed
    // {#each} cross-fades the outgoing and incoming icon.
    $effect(() => {
        if (cardBrand !== prevBrand) {
            prevBrand = cardBrand;
            stack = [{ brand: cardBrand, id: nextId++ }];
        }
    });

    // Cross-fade swap: fade + scale + blur, driving `--slide-progress` so the
    // fanned brand list slides in. `enabled` gates the very first render.
    function cardSwap(_node: Element, { enabled = true }: { enabled?: boolean }): TransitionConfig {
        if (!enabled) return { duration: 0 };
        return {
            duration: 300,
            easing: cubicOut,
            css: (t) =>
                `opacity:${t}; scale:${0.8 + 0.2 * t}; filter:blur(${1 - t}px); --slide-progress:${t};`,
        };
    }
</script>

<div class="bias-cardIconStack 🔒 bias:grid bias:absolute bias:right-2 bias:top-1/2 bias:-translate-y-1/2">
    {#each stack as entry (entry.id)}
        <div
            class="🔒 bias:col-start-1 bias:row-start-1 bias:origin-right"
            transition:cardSwap={{ enabled: mounted }}
        >
            {#if entry.brand}
                <div in:fade={{ duration: 300, delay: 25 }}>
                    <CardIcon brand={entry.brand as CardBrand} />
                </div>
            {:else}
                <div class="🔒 brandList bias:flex bias:items-center bias:gap-1.5">
                    <CardIcon brand="visa" sliding cardIndex={3} />
                    <CardIcon brand="mastercard" sliding cardIndex={2} />
                    <CardIcon brand="american-express" sliding cardIndex={1} />
                    <CardIcon brand="discover" sliding cardIndex={0} />
                </div>
                <div class="🔒 rotatingContainer bias:place-items-center">
                    <div class="🔒 bias:col-start-1 bias:row-start-1"><RotatingCardIcon /></div>
                </div>
            {/if}
        </div>
    {/each}
</div>

<style>
    @container (max-width: 325px) {
        .brandList {
            display: none;
        }
    }

    .rotatingContainer {
        display: none;
    }

    @container (max-width: 325px) {
        .rotatingContainer {
            display: grid;
        }
    }
</style>
