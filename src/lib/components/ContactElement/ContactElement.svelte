<script lang="ts">
    import { getBiasContext, type Appearance } from "~/context.svelte";
    import { appearance as appearanceAction } from "~/utils/appearance";
    import FieldGroup from "../FieldGroup/FieldGroup.svelte";
    import PhoneInput from "../AddressElement/PhoneInput.svelte";
    import EmailInput from "./EmailInput.svelte";

    type Props = {
        appearance?: Appearance;
        readOnly?: boolean;
        collectEmail?: boolean;
        collectPhone?: boolean;
    };

    let { appearance, readOnly, collectEmail = true, collectPhone = false }: Props = $props();

    const ctx = getBiasContext();

    $effect(() =>
        ctx.registerCollector({
            kind: "contact",
            fields: [
                ...(collectEmail ? (["email"] as const) : []),
                ...(collectPhone ? (["phone"] as const) : []),
            ],
        }),
    );
</script>

{#if !ctx.sessionLoading}
    <div class="bias-form 🔒 bias:flex bias:flex-col bias:gap-(--bias-gap)" use:appearanceAction={appearance}>
        {#if collectEmail}
            <FieldGroup label="Email" fieldType="email" {appearance} error={ctx.fieldState.email.error}>
                {#snippet input(placeholder, id)}
                    <EmailInput {id} {placeholder} {readOnly} />
                {/snippet}
            </FieldGroup>
        {/if}
        {#if collectPhone}
            <FieldGroup label="Phone" fieldType="phone" {appearance} error={ctx.fieldState.phone.error}>
                {#snippet input(placeholder, id)}
                    <PhoneInput {id} {placeholder} contact />
                {/snippet}
            </FieldGroup>
        {/if}
    </div>
{/if}
