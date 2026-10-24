<script lang="ts">
    import parsePhoneNumber, { type CountryCode } from "libphonenumber-js";

    import { getAddressScope, getBiasContext } from "~/context.svelte";
    import FieldShell from "../Field/FieldShell.svelte";
    import { scopedAutocomplete } from "./autocomplete";

    type Props = {
        id?: string;
        placeholder?: string;
        /** The customer's contact phone, rather than the address scope's phone. */
        contact?: boolean;
    };

    let { id, placeholder, contact = false }: Props = $props();

    const ctx = getBiasContext();
    const scope = $derived(contact ? "billing" : getAddressScope());

    const disabled = $derived(ctx.submitDisabled);
    const phone = $derived(ctx.getField(scope, contact ? "phone" : "shippingPhone"));
    const country = $derived(ctx.getField(scope, "country").value);
    const autocomplete = $derived(contact ? "tel" : scopedAutocomplete(scope, "tel"));

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
            // so the validator (which parses against the scope's country) still accepts it.
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
    class="bias-phone 🔒"
    {disabled}
    focused={phone.state.focused}
    error={phone.state.error}
>
    <input
        {id}
        data-bias-hostField
        class="bias-hostField 🔒"
        type="tel"
        inputmode="tel"
        {autocomplete}
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
