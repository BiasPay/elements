<script lang="ts">
    import type { Snippet } from "svelte";
    import { getBiasContext } from "~/context.svelte";
    import { cn } from "~/utils/classes";
    import type { IconSource } from "../Icon/icon.ts";
    import Icon from "../Icon/Icon.svelte";
    import Radio from "../Radio/Radio.svelte";

    type Props = {
        label: string;
        detail?: string;
        secondaryDetail?: string;
        saving?: string;
        icon?: IconSource;
        leading?: Snippet;
        selected?: boolean;
        first?: boolean;
        last?: boolean;
        onselect?: () => void;
        content: Snippet;
    };

    let {
        label,
        detail,
        secondaryDetail,
        saving,
        icon,
        leading,
        selected = false,
        first = false,
        last = false,
        onselect,
        content,
    }: Props = $props();

    const ctx = getBiasContext();
    const disabled = $derived(ctx.snapshot.submitDisabled);
</script>

<div
    style:--calculated-radius="calc(var(--bias-border-radius) + 2px)"
    class={cn(
        "bias-paymentMethodRadioOption 🔒 bias:relative bias:flex bias:flex-col bias:border-l bias:border-r bias:border-border bias:bg-background",
        selected ? "bias:z-10" : "bias:hover:z-10",
        first && "bias:rounded-t-(--calculated-radius) bias:border-t bias:border-border",
        !first && "bias:border-t bias:border-border",
        last && "bias:rounded-b-(--calculated-radius) bias:border-b bias:border-border",
    )}
>
    <button
        type="button"
        role="radio"
        aria-checked={selected ? "true" : "false"}
        tabindex={selected ? 0 : -1}
        class={cn(
            "🔒 bias:group bias:relative bias:isolate bias:flex bias:w-full bias:items-center bias:gap-2.5 bias:px-4.5 bias:py-3.5 bias:bg-transparent bias:border-none bias:outline-none bias:focus:outline-none bias:transition-colors bias:duration-200",
            disabled
                ? "bias:cursor-default bias:pointer-events-none"
                : selected
                  ? "bias:text-primary bias:cursor-default bias:font-medium"
                  : "bias:text-muted-foreground bias:cursor-pointer",
        )}
        {disabled}
        onclick={() => onselect?.()}
    >
        <div
            class="🔒 bias:absolute bias:inset-1 bias:-z-10 bias:rounded-[calc(var(--bias-border-radius)-2px)] bias:bg-[color-mix(in_srgb,var(--bias-color-foreground)_6%,transparent)] bias:opacity-0 bias:transition-[opacity,transform] bias:duration-150 bias:group-hover:opacity-100 bias:group-active:[transform:scaleX(0.988)_scaleY(0.86)]"
        ></div>
        <Radio name="payment-method" {selected} presentational />
        <span class="🔒 bias:flex bias:w-7 bias:items-center bias:justify-center">
            {#if leading}
                {@render leading()}
            {:else if icon}
                <Icon src={icon} class="🔒 bias:size-5" theme="mini" />
            {/if}
        </span>
        <div class="🔒 bias:flex bias:grow bias:items-center bias:justify-between bias:gap-3">
            <span class="🔒 bias:text-[0.9375rem]">{label}</span>
            {#if detail || secondaryDetail || saving}
                <span class="🔒 bias:flex bias:flex-col bias:items-end bias:text-right bias:font-normal">
                    {#if detail}<span class="🔒 bias:text-[0.8125rem] bias:text-foreground">{detail}</span>{/if}
                    {#if secondaryDetail}
                        <span class="🔒 bias:text-[0.75rem] bias:text-muted-foreground">{secondaryDetail}</span>
                    {/if}
                    {#if saving}<span class="🔒 bias:text-[0.75rem] bias:font-medium bias:text-success">{saving}</span>{/if}
                </span>
            {/if}
        </div>
    </button>

    <div
        class={cn(
            "🔒 bias:grid bias:overflow-clip bias:transition-[grid-template-rows,translate,opacity] bias:duration-500 bias:ease-(--ease-in-out-smooth)",
            selected
                ? "bias:grid-rows-[1fr] bias:opacity-100"
                : "bias:grid-rows-[0fr] bias:opacity-0 bias:-translate-y-0.75 bias:starting:grid-rows-[0fr] bias:starting:opacity-0 bias:starting:-translate-y-0.75",
        )}
        inert={!selected}
    >
        <div class="🔒 bias:min-h-0 bias:px-4 bias:*:pt-1 bias:*:pb-4">{@render content()}</div>
    </div>
</div>
