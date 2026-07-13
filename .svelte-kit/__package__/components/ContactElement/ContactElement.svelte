<script lang="ts">
    import { getBiasContext, type Appearance } from "../../context.svelte";
    import { appearance as appearanceAction } from "../../utils/appearance";
    import FieldGroup from "../FieldGroup/FieldGroup.svelte";
    import EmailInput from "./EmailInput.svelte";

    type Props = {
        appearance?: Appearance;
    };

    let { appearance }: Props = $props();

    const ctx = getBiasContext();

    $effect(() => ctx.registerCollector({ kind: "contact", fields: ["email"] }));
</script>

{#if !ctx.sessionLoading}
    <div class="bias-form 🔒 bias:flex bias:flex-col bias:gap-(--bias-gap)" use:appearanceAction={appearance}>
        <FieldGroup label="Email" fieldType="email" {appearance} error={ctx.fieldState.email.error}>
            {#snippet input(placeholder, id)}
                <EmailInput {id} {placeholder} />
            {/snippet}
        </FieldGroup>
    </div>
{/if}
