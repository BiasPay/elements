<script lang="ts">
    import type { Appearance } from "../../core";
    import { getBiasContext } from "../../context.svelte";
    import { cn } from "../../utils/classes";
    import { methodConfig, type PaymentMethod } from "./paymentMethods.js";
    import PaymentMethodTab from "./PaymentMethodTab.svelte";
    import PaymentMethodForm from "./PaymentMethodForm.svelte";

    type Props = {
        paymentMethods: PaymentMethod[];
        appearance?: Appearance;
    };

    let { paymentMethods, appearance }: Props = $props();

    const ctx = getBiasContext();
    const instanceId = $props.id();
    const tabId = (method: PaymentMethod) => `bias-tab-${instanceId}-${method}`;
    const panelId = (method: PaymentMethod) => `bias-tabPanel-${instanceId}-${method}`;
    const selectedMethod = $derived(ctx.snapshot.selectedPaymentMethod);
    const session = $derived(ctx.checkoutSession);

    function handleKeydown(event: KeyboardEvent) {
        if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key)) return;
        event.preventDefault();

        const currentIndex = Math.max(0, selectedMethod ? paymentMethods.indexOf(selectedMethod) : 0);
        const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
        const nextIndex = event.key === "Home"
            ? 0
            : event.key === "End"
              ? paymentMethods.length - 1
              : (currentIndex + direction + paymentMethods.length) % paymentMethods.length;
        const nextMethod = paymentMethods[nextIndex];
        if (!nextMethod) return;

        ctx.setPaymentMethod(nextMethod);
        const tablist = event.currentTarget as HTMLElement;
        queueMicrotask(() => tablist.querySelectorAll<HTMLElement>('[role="tab"]')[nextIndex]?.focus());
    }
</script>

<div class="bias-tabList 🔒 bias:@container/tab-list bias:flex bias:flex-col">
    <!-- Keyboard events bubble from the roving-tabindex tabs. -->
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div
        class="bias-tabBar 🔒 bias:flex bias:flex-row bias:gap-2 bias:p-0.5 bias:-m-0.5 bias:@max-[300px]/tab-list:flex-col"
        role="tablist"
        aria-label="Payment method"
        onkeydown={handleKeydown}
    >
        {#each paymentMethods as method (method)}
            {@const config = methodConfig[method]}
            <PaymentMethodTab
                id={tabId(method)}
                controls={panelId(method)}
                label={config.label}
                icon={config.icon}
                selected={selectedMethod === method}
                discountPercentage={method !== "card" ? session?.dual_pricing?.rate : undefined}
                onselect={() => ctx.setPaymentMethod(method)}
            />
        {/each}
    </div>
    <div class="bias-tabPanels 🔒 bias:grid bias:overflow-y-clip">
        {#each paymentMethods as method (method)}
            {@const selected = selectedMethod === method}
            <div
                id={panelId(method)}
                role="tabpanel"
                aria-labelledby={tabId(method)}
                hidden={!selected}
                class={cn(
                    "bias-tabPanel 🔒 contentPanel bias:col-start-1 bias:row-start-1",
                    selected ? "bias:z-1 bias:opacity-100" : "bias:h-0 bias:opacity-0 bias:pointer-events-none",
                )}
                inert={!selected}
            >
                <PaymentMethodForm {method} {appearance} />
            </div>
        {/each}
    </div>
</div>

<style>
    .contentPanel > :global(*) {
        padding-top: 1rem;
        padding-bottom: 0.25rem;
    }
</style>
