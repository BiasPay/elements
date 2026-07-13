<script lang="ts">
    import parsePhoneNumber, {
        getCountryCallingCode,
        type CountryCode,
    } from "libphonenumber-js";
    import { validatePhone } from "../../core";
    import { getAddressScope, getBiasContext } from "../../context.svelte";
    import { cn } from "../../utils/classes";
    import FieldShell from "../Field/FieldShell.svelte";

    type Props = {
        id?: string;
        placeholder?: string;
    };

    let { id, placeholder }: Props = $props();

    const ctx = getBiasContext();
    const scope = $derived(getAddressScope());

    const disabled = $derived(ctx.submitDisabled);
    const phone = $derived(ctx.getField(scope, "phone"));
    const country = $derived(ctx.getField(scope, "country").value);

    function callingCode(): string | null {
        try {
            return getCountryCallingCode(country as CountryCode);
        } catch {
            return null;
        }
    }

    const prefix = $derived(callingCode());

    // Register the phone validator once, and clean it up on unmount.
    $effect(() => {
        return phone.setValidator((value) => {
            const result = validatePhone(
                value,
                ctx.getField(scope, "country").value,
                { showRequired: false },
            );
            return { isValid: result.valid, error: result.error };
        });
    });

    // When the country changes, clear the error and re-set the value so the
    // (country-aware) validator re-runs against the new country.
    let prevCountry: string | undefined;
    $effect(() => {
        const current = country;
        if (prevCountry !== undefined && prevCountry !== current) {
            phone.setState({ error: null });
            phone.setValue(phone.value);
        }
        prevCountry = current;
    });

    function handleBlur() {
        phone.setState({ focused: false });

        if (!phone.value.trim()) {
            phone.validate();
            return;
        }

        const current = country as CountryCode;
        const parsed = parsePhoneNumber(phone.value, current);
        if (parsed?.isValid()) {
            // Keep the international format when the number belongs to another country
            // so the validator (which parses against the billing country) still accepts it.
            phone.setValue(
                parsed.country === current
                    ? parsed.formatNational()
                    : parsed.formatInternational(),
            );
            return;
        }

        phone.validate();
    }
</script>

<FieldShell
    class="bias-phone 🔒 bias:flex bias:items-center"
    {disabled}
    focused={phone.state.focused}
    error={phone.state.error}
>
    {#if prefix}
        <span
            class="bias-phonePrefix 🔒 bias:shrink-0 bias:pl-[0.675rem] bias:text-(length:--bias-font-size) bias:text-(--bias-color-placeholder)"
            style="font-family: var(--bias-font-family);"
        >+{prefix}</span>
    {/if}
    <input
        {id}
        data-bias-hostField
        class={cn("bias-hostField 🔒", prefix && "bias:pl-[0.375rem]")}
        type="tel"
        inputmode="tel"
        autocomplete="tel"
        value={phone.value}
        placeholder={placeholder ?? "Phone number"}
        {disabled}
        aria-invalid={phone.state.error ? "true" : undefined}
        oninput={(e) => {
            phone.setState({ error: null });
            phone.setValue((e.currentTarget as HTMLInputElement).value);
        }}
        onfocus={() => phone.setState({ focused: true })}
        onblur={handleBlur}
    />
</FieldShell>
