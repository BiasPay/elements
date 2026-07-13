<script lang="ts">
    import { resolveIcon, type IconSource } from "./icon.js";

    type Props = {
        src: IconSource | undefined;
        theme?: string;
        title?: string;
        class?: string;
    };

    let { src, theme = "default", title, class: className }: Props = $props();

    const icon = $derived(resolveIcon(src, theme));
    const attrs = $derived(icon?.a ?? {});
</script>

{#if icon}
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={attrs.viewBox ?? ""}
        fill={attrs.fill ?? "none"}
        stroke={attrs.stroke ?? "none"}
        stroke-width={attrs["stroke-width"] ?? attrs.strokeWidth ?? ""}
        class={className}
    >
        {#if title}<title>{title}</title>{/if}
        {#each icon.path ?? [] as a}<path {...a} />{/each}
        {#each icon.rect ?? [] as a}<rect {...a} />{/each}
        {#each icon.circle ?? [] as a}<circle {...a} />{/each}
        {#each icon.polygon ?? [] as a}<polygon {...a} />{/each}
        {#each icon.polyline ?? [] as a}<polyline {...a} />{/each}
        {#each icon.line ?? [] as a}<line {...a} />{/each}
    </svg>
{/if}
