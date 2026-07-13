<script lang="ts">
    import type { Snippet } from "svelte";
    import { cn } from "../../utils/classes";

    /** Any truthy value adds the state class; the field's error message counts as truthy. */
    type ClassFlag = boolean | string | null | undefined;

    type Props = {
        /** Extra class(es) appended after the base `bias-field`. */
        class?: string;
        focused?: ClassFlag;
        error?: ClassFlag;
        disabled?: ClassFlag;
        /** Frame inputs tag their wrapper for external targeting; text inputs don't. */
        dataFieldType?: string;
        children: Snippet;
    };

    let { class: className, focused, error, disabled, dataFieldType, children }: Props = $props();
</script>

<div
    class={cn(
        "bias-field",
        className,
        disabled && "bias-fieldDisabled",
        focused && "bias-fieldFocus",
        error && "bias-fieldError",
    )}
    data-field-type={dataFieldType}
>
    {@render children()}
</div>
