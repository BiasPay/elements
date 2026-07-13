<script lang="ts">
    import type { Appearance } from "~/core";
    import { getBiasContext } from "~/context.svelte";
    import { methodConfig, type PaymentMethod } from "./paymentMethods.ts";
    import PaymentMethodRadioOption from "./PaymentMethodRadioOption.svelte";
    import PaymentMethodForm from "./PaymentMethodForm.svelte";

    type Props = {
        paymentMethods: PaymentMethod[];
        appearance?: Appearance;
    };

    let { paymentMethods, appearance }: Props = $props();

    const ctx = getBiasContext();
    const selectedMethod = $derived(ctx.snapshot.selectedPaymentMethod);

    function handleKeydown(event: KeyboardEvent) {
        if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) return;
        event.preventDefault();

        const currentIndex = Math.max(0, selectedMethod ? paymentMethods.indexOf(selectedMethod) : 0);
        const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
        const nextIndex = (currentIndex + direction + paymentMethods.length) % paymentMethods.length;
        const nextMethod = paymentMethods[nextIndex];
        if (!nextMethod) return;

        ctx.setPaymentMethod(nextMethod);
        const group = event.currentTarget as HTMLElement;
        queueMicrotask(() => group.querySelectorAll<HTMLElement>('[role="radio"]')[nextIndex]?.focus());
    }
</script>

<!-- Keyboard events bubble from the roving-tabindex radio buttons. -->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div
    class="bias-radioList 🔒 bias:rounded-[10px] bias:overflow-clip bias:shadow-(--bias-shadow)"
    role="radiogroup"
    aria-label="Payment method"
    onkeydown={handleKeydown}
>
    {#each paymentMethods as method, index (method)}
        {@const config = methodConfig[method]}
        <PaymentMethodRadioOption
            label={config.label}
            icon={config.icon}
            selected={selectedMethod === method}
            first={index === 0}
            last={index === paymentMethods.length - 1}
            onselect={() => ctx.setPaymentMethod(method)}
        >
            {#snippet content()}
                <PaymentMethodForm {method} {appearance} />
            {/snippet}
        </PaymentMethodRadioOption>
    {/each}
</div>
