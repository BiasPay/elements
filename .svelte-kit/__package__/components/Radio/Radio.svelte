<script lang="ts">
    import { cn } from "../../utils/classes";

    type Props = {
        selected?: boolean;
        disabled?: boolean;
        name?: string;
        onselect?: () => void;
        /**
         * Render a non-interactive dot when selection is owned by an ancestor
         * control (e.g. a `role="radio"` button), avoiding a nested radio input.
         */
        presentational?: boolean;
    };

    let {
        selected = false,
        disabled = false,
        name = "",
        onselect,
        presentational = false,
    }: Props = $props();

    const instanceId = $props.id();
    const id = `bias-radio-${instanceId}`;

    const boxClasses = (interactive: boolean) =>
        cn(
            "bias-radio 🔒",
            "bias:relative bias:mb-0 bias:grid bias:size-4 bias:place-items-center bias:rounded-full bias:shadow-[0_1px_2px_0_rgb(0_0_0_/_0.05)] bias:transition-[all] bias:duration-[250ms] bias:ease-out bias:border bias:border-[#d4d4d4] bias:bg-white",
            selected && "selected",
            disabled && "bias:opacity-60",
            interactive && !selected && !disabled && "bias:cursor-pointer",
        );
</script>

{#if presentational}
    <span class={boxClasses(false)} aria-hidden="true"></span>
{:else}
    <label class={boxClasses(true)} for={id}>
        <input
            type="radio"
            class="🔒 bias:absolute bias:inset-0 bias:opacity-0"
            {name}
            {disabled}
            checked={selected}
            value={id}
            {id}
            onchange={() => onselect?.()}
        />
    </label>
{/if}

<style>
    /*
     * Outline selected-state lives outside Tailwind layers so host resets like
     * `* { outline: 0 }` (unlayered) cannot override the filled radio indicator.
     */
    .bias-radio {
        outline-style: solid;
        outline-offset: 0;
        outline-width: 0;
        outline-color: transparent;
    }

    .bias-radio.selected {
        outline-offset: -5px;
        outline-width: 5px;
        outline-color: var(--bias-color-primary);
    }

    .bias-radio::after {
        content: "";
        transform: scale(0.5);
    }
</style>
