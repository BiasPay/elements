<script lang="ts">
    import type { Snippet } from "svelte";
    import type { Appearance } from "~/core";
    import { getAppearanceContext } from "~/context.svelte";
    import { cn } from "~/utils/classes";
    import { collapse } from "~/utils/transitions";
    import FormError from "../FormError/FormError.svelte";
    import FormLabel from "../FormLabel/FormLabel.svelte";

    type LabelStyle = NonNullable<Appearance["labelStyle"]>;

    type Props = {
        label: string;
        fieldName: string;
        filled: boolean;
        appearance?: Appearance;
        placeholder?: string;
        error?: string | null;
        feedback?: Snippet<[string]>;
        input: Snippet<[string | undefined, string, string | undefined, boolean]>;
    };

    let {
        label,
        fieldName,
        filled,
        appearance,
        placeholder,
        error,
        feedback,
        input,
    }: Props = $props();

    const labelStyle = $derived<LabelStyle>(
        appearance?.labelStyle ?? getAppearanceContext()?.labelStyle ?? "static",
    );
    const instanceId = $props.id();
    const inputId = $derived(`bias-${instanceId}-${fieldName}`);
    const errorId = $derived(`${inputId}-error`);
    const feedbackId = $derived(`${inputId}-feedback`);
    const describedBy = $derived(
        [error ? errorId : undefined, feedback ? feedbackId : undefined]
            .filter(Boolean)
            .join(" ") || undefined,
    );
    const resolvedPlaceholder = $derived(placeholder ?? label);
    const floatingLabelShrunk = $derived(labelStyle === "floating" && filled);
</script>

<div
    class={cn(
        "bias-fieldGroup",
        `bias-formField_${fieldName}`,
        "🔒 bias:flex bias:flex-col bias:gap-0",
    )}
>
    {#if labelStyle === "placeholder"}
        <FormLabel {label} for={inputId} class="🔒 bias:sr-only" />
        {@render input(resolvedPlaceholder, inputId, describedBy, floatingLabelShrunk)}
    {:else if labelStyle === "floating"}
        <div class={cn("bias-floatingLabel 🔒 bias:relative", filled && "shrink")}>
            <FormLabel
                {label}
                for={inputId}
                class={cn(
                    "bias:absolute bias:z-10 bias:top-[calc(var(--bias-floating-label-factor)*var(--bias-input-padding-block)-1.5px)] bias:left-(--bias-input-padding-inline) bias:pl-px bias:text-xs bias:ease-out bias:pointer-events-none bias:transition",
                    filled
                        ? "bias:opacity-100 bias:translate-y-0"
                        : "bias:opacity-0 bias:translate-y-0.75",
                )}
            />
            {@render input(resolvedPlaceholder, inputId, describedBy, floatingLabelShrunk)}
        </div>
    {:else}
        <FormLabel {label} for={inputId} />
        {@render input(placeholder, inputId, describedBy, floatingLabelShrunk)}
    {/if}
    <FormError id={errorId} message={error} />
    {#if feedback}
        <div transition:collapse={{ opacity: 0, translate: "0 -2px" }}>
            {@render feedback(feedbackId)}
        </div>
    {/if}
</div>

<style>
    .bias-floatingLabel {
        --bias-floating-label-factor: 0.675;

        :global(.bias-field) {
            min-height: calc(1lh + var(--bias-input-padding-block) * 2 + 0.4rem);
        }

        :global(input, select) {
            transition-property: padding;
            transition-duration: 0.2s;
            transition-timing-function: var(--ease-out);
        }

        &.shrink {
            :global(input, select) {
                padding-top: calc(
                    var(--bias-input-padding-block) * (1 + var(--bias-floating-label-factor))
                );
                padding-bottom: calc(
                    var(--bias-input-padding-block) * (1 - var(--bias-floating-label-factor))
                );
            }
        }
    }
</style>
