<script lang="ts">
    import { collapse } from "../../utils/transitions";
    import { cn } from "../../utils/classes";

    type Props = {
        message?: string | null;
        /** Adds extra top padding when shown standalone (not under a field). */
        standalone?: boolean;
    };

    let { message, standalone = false }: Props = $props();
</script>

{#if message}
    <div
        class="bias-formError"
        role="alert"
        aria-live="polite"
        transition:collapse={{ duration: 300, opacity: 0, translate: "0 -2px" }}
    >
        <div
            class={cn(
                "bias-formErrorContent 🔒 bias:min-h-0 bias:text-[0.875em] bias:font-medium bias:text-(--bias-color-error)",
                standalone ? "bias:pt-4" : "bias:pt-1",
            )}
        >
            {message}
        </div>
    </div>
{/if}
