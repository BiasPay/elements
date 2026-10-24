<script lang="ts">
    import type { Snippet } from "svelte";
    import { ExclamationCircle, InformationCircle } from "@steeze-ui/heroicons";
    import { cn } from "~/utils/classes";
    import Icon from "../Icon/Icon.svelte";

    type Props = {
        id?: string;
        variant: "advisory" | "error";
        children: Snippet;
    };

    let { id, variant, children }: Props = $props();
</script>

<div
    {id}
    class={cn(
        "bias-fieldFeedback 🔒 bias:flex bias:items-start bias:gap-1.5 bias:pt-1 bias:text-[0.875em] bias:font-medium",
        variant === "error"
            ? "bias:text-error"
            : "bias:text-muted-foreground",
    )}
    role={variant === "error" ? "alert" : "status"}
    aria-live="polite"
>
    <Icon
        src={variant === "error" ? ExclamationCircle : InformationCircle}
        theme="micro"
        class="🔒 bias:mt-[0.1em] bias:size-4 bias:shrink-0"
    />
    <span class={cn("🔒", variant === "error" ? "bias:text-error" : "bias:text-foreground")}>{@render children()}</span>
</div>
