<script lang="ts">
    import type { Snippet } from "svelte";
    import {
        scopedField,
        type Appearance,
        type FrameFieldType,
        type ValueFieldType,
    } from "~/core";
    import { getAddressScope, getAppearanceContext, getBiasContext } from "~/context.svelte";
    import { cn } from "~/utils/classes";
    import FormError from "../FormError/FormError.svelte";
    import FormLabel from "../FormLabel/FormLabel.svelte";

    type FieldType = FrameFieldType | ValueFieldType;
    type LabelStyle = NonNullable<Appearance["labelStyle"]>;
    const FRAME_FIELDS: FrameFieldType[] = [
        "cardNumber", "cardExpiry", "cardCvc", "bankRoutingNumber", "bankAccountNumber",
    ];

    type Props = {
        label: string;
        fieldType: FieldType;
        appearance?: Appearance;
        placeholder?: string;
        /** Error shown below the field, if any. Omit for fields that never carry one. */
        error?: string | null;
        /** Builds the field's input, given the placeholder this group wants shown and the id to assign it. */
        input: Snippet<[string | undefined, string]>;
    };

    let { label, fieldType, appearance, placeholder, error, input }: Props = $props();

    const ctx = getBiasContext();
    const scope = $derived(getAddressScope());

    /** Frame field types never appear in `ValueFieldType`. */
    function isValueFieldType(type: FieldType): type is ValueFieldType {
        return !(FRAME_FIELDS as FieldType[]).includes(type);
    }

    const labelStyle = $derived<LabelStyle>(
        appearance?.labelStyle ?? getAppearanceContext()?.labelStyle ?? "static",
    );
    const slot = $derived(
        isValueFieldType(fieldType) ? scopedField(fieldType, scope) : fieldType,
    );
    const field = $derived(ctx.fieldState[slot]);
    const shrink = $derived(!("empty" in field ? field.empty : !field.value));
    const instanceId = $props.id();
    const inputId = $derived(`bias-${instanceId}-${slot}`);

    const resolvedPlaceholder = $derived(placeholder ?? label);
</script>

<div
    class={cn("bias-fieldGroup", `bias-formField_${slot}`, "🔒 bias:flex bias:flex-col bias:gap-0")}>
    {#if labelStyle === "placeholder"}
        <FormLabel {label} for={inputId} class="🔒 bias:sr-only" />
        {@render input(resolvedPlaceholder, inputId)}
    {:else if labelStyle === "floating"}
        <div
            class={cn("bias-floatingLabel 🔒 bias:relative", shrink && "shrink")}
        >
            <FormLabel
                {label}
                for={inputId}
                class={cn(
                    "bias:absolute bias:z-10 bias:top-[calc(var(--factor)*var(--bias-input-padding-block)-1.5px)] bias:left-(--bias-input-padding-inline) bias:pl-px bias:text-xs bias:ease-out bias:pointer-events-none bias:transition",
                    shrink ? "bias:opacity-100 bias:translate-y-0" : "bias:opacity-0 bias:translate-y-0.75",
                )}
            />
            {@render input(resolvedPlaceholder, inputId)}
        </div>
    {:else}
        <FormLabel {label} for={inputId} />
        {@render input(placeholder, inputId)}
    {/if}
    <FormError message={error} />
</div>

<style>
    .bias-floatingLabel {
        --factor: 0.675;

        :global(.bias-field) {
            min-height: calc(1lh + var(--bias-input-padding-block) * 2 + 0.4rem);
        }

        :global(input, select, .bias-fieldFrame > *) {
            transition-property: padding, translate;
            transition-duration: 0.2s;
            transition-timing-function: var(--ease-out);
        }

        &.shrink {
            :global(input, select) {
                padding-top: calc(var(--bias-input-padding-block) * (1 + var(--factor)));
                padding-bottom: calc(var(--bias-input-padding-block) * (1 - var(--factor)));
            }
            :global(.bias-fieldFrame > *) {
                translate: 0 calc(var(--bias-input-padding-block) * 0.6725);
            }
        }
    }
</style>
