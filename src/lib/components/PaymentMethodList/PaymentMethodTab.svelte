<script lang="ts">
    import { getBiasContext } from "~/context.svelte";
    import { cn } from "~/utils/classes";
    import type { IconSource } from "../Icon/icon.ts";
    import Icon from "../Icon/Icon.svelte";

    type Props = {
        label: string;
        icon?: IconSource;
        selected?: boolean;
        saving?: string;
        onselect?: () => void;
        /** `id` of this tab and of the tabpanel it controls, for ARIA wiring. */
        id?: string;
        controls?: string;
    };

    let { label, icon, selected = false, saving, onselect, id, controls }: Props = $props();

    const ctx = getBiasContext();
    const disabled = $derived(ctx.snapshot.submitDisabled);
</script>

<button
    type="button"
    role="tab"
    {id}
    aria-controls={controls}
    aria-selected={selected ? "true" : "false"}
    tabindex={selected ? 0 : -1}
    class={cn(
        "bias-paymentMethodTab 🔒 bias:relative bias:isolate bias:flex bias:flex-1 bias:py-3 bias:px-3.5 bias:border bias:rounded-bias bias:border-border bias:bg-input bias:shadow-(--bias-shadow) bias:font-medium bias:cursor-pointer bias:transition-[border-color,box-shadow,color,background-color] bias:duration-200 bias:text-muted-foreground",
        disabled && "bias:cursor-default bias:pointer-events-none",
        !disabled &&
            selected &&
            "bias:border-primary bias:shadow-[var(--bias-shadow),0_0_0_1px_var(--bias-color-primary)] bias:text-primary bias:cursor-default",
    )}
    {disabled}
    onclick={() => onselect?.()}
>
    <div class="🔒 bias:flex bias:flex-col bias:items-start bias:justify-center bias:text-start bias:gap-1.5">
        {#if icon}
            <span class="iconSize"><Icon src={icon} theme="mini" /></span>
        {/if}
        <span class="🔒 bias:text-[0.8125rem] bias:leading-none">{label}</span>
    </div>
    {#if saving}
        <div class="🔒 bias:flex bias:ml-auto bias:items-end bias:justify-end bias:text-end bias:text-xs bias:leading-none bias:text-success">
            {saving}
        </div>
    {/if}
</button>

<style>
    .iconSize :global(svg) {
        width: 1.25rem;
        height: 1.25rem;
        display: block;
    }
</style>
