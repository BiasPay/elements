<script lang="ts">
    import type { Snippet } from "svelte";
    import { getBiasContext } from "../../context.svelte";
    import { cn } from "../../utils/classes";
    import type { IconSource } from "../Icon/icon.js";
    import Icon from "../Icon/Icon.svelte";
    import Radio from "../Radio/Radio.svelte";

    type Props = {
        label: string;
        icon?: IconSource;
        selected?: boolean;
        first?: boolean;
        last?: boolean;
        onselect?: () => void;
        content: Snippet;
    };

    let { label, icon, selected = false, first = false, last = false, onselect, content }: Props =
        $props();

    const ctx = getBiasContext();
    const disabled = $derived(ctx.snapshot.submitLoading || ctx.snapshot.submitSuccess);
</script>

<div
    style:--calculated-radius="calc(var(--bias-border-radius) + 2px)"
    class={cn(
        "bias-paymentMethodRadioOption 🔒 bias:relative bias:flex bias:flex-col bias:border-l bias:border-r bias:border-(--bias-color-border) bias:bg-(--bias-color-background)",
        selected ? "bias:z-10" : "bias:hover:z-10",
        first && "bias:rounded-t-(--calculated-radius) bias:border-t bias:border-(--bias-color-border)",
        !first && "bias:border-t bias:border-(--bias-color-border)",
        last && "bias:rounded-b-(--calculated-radius) bias:border-b bias:border-(--bias-color-border)",
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
                  ? "bias:text-(--bias-color-primary) bias:cursor-default bias:font-medium"
                  : "bias:text-(--bias-color-muted-foreground) bias:cursor-pointer",
        )}
        {disabled}
        onclick={() => onselect?.()}
    >
        <div
            class="🔒 bias:absolute bias:inset-1 bias:-z-10 bias:rounded-[calc(var(--bias-border-radius)-2px)] bias:bg-[color-mix(in_srgb,black_4%,transparent)] bias:opacity-0 bias:transition-[opacity,transform] bias:duration-150 bias:group-hover:opacity-100 bias:group-active:[transform:scaleX(0.988)_scaleY(0.86)]"
        ></div>
        <Radio name="payment-method" {selected} presentational />
        <span class="🔒 bias:flex bias:w-6 bias:items-center bias:justify-center">
            {#if icon}
                <Icon src={icon} class="🔒 bias:size-5" theme="mini" />
            {/if}
        </span>
        <div class="🔒 bias:flex bias:grow bias:items-center bias:justify-between">
            <span class="🔒 bias:text-[0.9375rem]">{label}</span>
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
