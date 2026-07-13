<script lang="ts">
    import { onDestroy } from "svelte";
    import { getAddressScope, getBiasContext } from "~/context.svelte";
    import { PatternMask } from "~/utils/pattern-mask";
    import FieldShell from "./FieldShell.svelte";

    // Typing-guide masks for common formats; validation covers every country
    // via address metadata.
    const POSTAL_CODE_MASKS: Record<string, string> = {
        US: "00000[-0000]",
        CA: "A0A 0A0",
        GB: "A[A]0[0][A] 0AA",
    };

    type Props = {
        id?: string;
        placeholder?: string;
    };

    let { id, placeholder }: Props = $props();

    const ctx = getBiasContext();
    const scope = $derived(getAddressScope());

    let inputEl = $state<HTMLInputElement>();
    let mask: PatternMask | undefined;
    let prevCountry: string | undefined;

    const disabled = $derived(ctx.submitDisabled);
    const postalCode = $derived(ctx.getField(scope, "postalCode"));
    const country = $derived(ctx.getField(scope, "country"));
    const metadata = $derived(ctx.addressMetadata(scope));
    const resolvedPlaceholder = $derived(
        placeholder ?? metadata.postalCode.example ?? metadata.postalCode.label,
    );

    function setupMask() {
        mask?.destroy();
        mask = undefined;
        if (!inputEl) return;

        const maskPattern = POSTAL_CODE_MASKS[country.value];
        if (maskPattern) {
            mask = new PatternMask(inputEl, {
                pattern: maskPattern,
                definitions: { A: /[A-Z]/ },
                prepare: (value) => value.toUpperCase(),
                onAccept: (value) => {
                    postalCode.setState({ error: null });
                    postalCode.setValue(value);
                },
            });
            if (postalCode.value) {
                mask.value = postalCode.value;
            }
        } else {
            inputEl.value = postalCode.value;
        }
    }

    // Set up on mount and rebuild whenever the country changes (the store
    // clears the value on country change; the mask pattern is country-specific).
    $effect(() => {
        const current = country.value;
        if (!inputEl) return;
        if (prevCountry === undefined || prevCountry !== current) {
            setupMask();
        }
        prevCountry = current;
    });

    onDestroy(() => mask?.destroy());

    function handleInput(e: Event) {
        if (!mask) {
            postalCode.setState({ error: null });
            postalCode.setValue((e.currentTarget as HTMLInputElement).value);
        }
    }

    function handleFocus() {
        postalCode.setState({ focused: true });
    }

    function handleBlur() {
        postalCode.setState({ focused: false });
        postalCode.validate();
    }
</script>

<FieldShell
    class="bias-postalCode"
    {disabled}
    focused={postalCode.state.focused}
    error={postalCode.state.error}
>
    <input
        {id}
        bind:this={inputEl}
        data-bias-hostField
        class="bias-hostField"
        type="text"
        inputmode={metadata.postalCode.numeric ? "numeric" : "text"}
        autocomplete="postal-code"
        value={postalCode.value}
        placeholder={resolvedPlaceholder}
        {disabled}
        aria-invalid={postalCode.state.error ? "true" : undefined}
        oninput={handleInput}
        onfocus={handleFocus}
        onblur={handleBlur}
    />
</FieldShell>
