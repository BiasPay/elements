<script lang="ts">
    import { collapse } from "~/utils/transitions";
    import { cn } from "~/utils/classes";

    type Props = {
        id?: string;
        message?: string | null;
        /** Adds extra top padding when shown standalone (not under a field). */
        standalone?: boolean;
        /** Sits right above the submit button instead of under what it's about. */
        above?: boolean;
    };

    let { id, message, standalone = false, above = false }: Props = $props();
</script>

{#if message}
    <div
        {id}
        class="bias-formError"
        role="alert"
        aria-live="polite"
        transition:collapse={{ opacity: 0, translate: "0 -2px" }}
    >
        <div
            class={cn(
                "bias-formErrorContent 🔒 bias:min-h-0 bias:text-[0.875em] bias:font-medium bias:text-error",
                above ? "bias:pb-3" : standalone ? "bias:pt-4" : "bias:pt-1",
            )}
        >
            {message}
        </div>
    </div>
{/if}
