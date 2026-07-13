<script lang="ts">
    import { cn } from "~/utils/classes";
    import { type CardBrand, cardBrandSvgs } from "./brands.ts";

    type Props = {
        brand?: CardBrand;
        /** Positions the icon in the fanned brand list (reads `--slide-progress`). */
        sliding?: boolean;
        cardIndex?: number;
        class?: string;
    };

    let { brand, sliding = false, cardIndex = 0, class: className }: Props = $props();

    const svg = $derived(brand ? (cardBrandSvgs[brand] ?? cardBrandSvgs.invalid) : "");
</script>

{#if brand}
    <div
        class={cn(
            "bias-cardIcon 🔒",
            "bias:grid",
            sliding && "bias:translate-x-[calc(2rem*var(--card-index,0)*(1-var(--slide-progress)))]",
            className,
        )}
        style={sliding ? `--card-index:${cardIndex}` : undefined}
    >
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        <div class="🔒 bias:col-start-1 bias:row-start-1 bias:h-[18.66px] bias:w-7 bias:justify-self-end">{@html svg}</div>
    </div>
{/if}
