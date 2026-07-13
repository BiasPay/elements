<script lang="ts">
    import { cn } from "~/utils/classes";

    type Props = {
        checked?: boolean;
        disabled?: boolean;
        label?: string;
        onchange?: (detail: { checked: boolean }) => void;
    };

    let { checked = false, disabled = false, label = "", onchange }: Props = $props();

    const instanceId = $props.id();
    const id = `bias-checkbox-${instanceId}`;
</script>

<label
    class={cn(
        "bias-checkbox 🔒",
        "bias:flex bias:items-center bias:gap-2 bias:mb-0 bias:select-none bias:cursor-pointer",
        disabled && "bias:opacity-60 bias:cursor-default",
    )}
    for={id}
>
    <span
        class={cn(
            "🔒 box",
            "bias:relative bias:grid bias:shrink-0 bias:size-4 bias:place-items-center bias:rounded bias:shadow-[0_1px_2px_0_rgb(0_0_0_/_0.05)] bias:transition-[all,outline-color] bias:duration-[250ms] bias:ease-out bias:border bias:border-[#d4d4d4] bias:bg-white bias:outline-2 bias:outline-transparent bias:has-[:focus-visible]:outline-(--bias-color-primary)/50",
            checked && "boxChecked bias:border-(--bias-color-primary) bias:bg-(--bias-color-primary)",
        )}
    >
        <svg
            class="🔒 checkPath bias:relative bias:size-[0.7rem] bias:text-white bias:pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="none"
        >
            <path pathLength="1" d="M3.5 8.5l3 3 6-7" />
        </svg>
        <input
            type="checkbox"
            class={cn("🔒 bias:absolute bias:inset-0 bias:opacity-0", disabled ? "bias:cursor-default" : "bias:cursor-pointer")}
            {disabled}
            {checked}
            {id}
            onchange={(e) => onchange?.({ checked: (e.currentTarget as HTMLInputElement).checked })}
        />
    </span>
    {#if label}<span class="🔒 bias:text-[0.875em] bias:text-(--bias-color-muted-foreground)">{label}</span>{/if}
</label>

<style>
    .checkPath path {
        fill: transparent;
        stroke: currentColor;
        stroke-width: 2.5;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-dasharray: 1;
        stroke-dashoffset: 1;
        transition: stroke-dashoffset 200ms ease-out;
    }

    .boxChecked .checkPath path {
        stroke-dashoffset: 0;
        transition-delay: 50ms;
    }
</style>
