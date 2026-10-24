<script lang="ts">
    import type { Appearance, SavedPaymentMethod } from "~/core";
    import { getBiasContext } from "~/context.svelte";
    import CardIcon from "../CardIcon/CardIcon.svelte";
    import type { CardBrand } from "../CardIcon/brands.ts";
    import Icon from "../Icon/Icon.svelte";
    import { methodConfig, savingLabel, type PaymentMethod } from "./paymentMethods.ts";
    import PaymentMethodForm from "./PaymentMethodForm.svelte";
    import PaymentMethodRadioOption from "./PaymentMethodRadioOption.svelte";

    type Props = {
        paymentMethods: PaymentMethod[];
        savedPaymentMethods?: readonly SavedPaymentMethod[];
        savedPaymentMethodEmail?: string;
        collectBillingName?: boolean;
        collectBillingAddress?: boolean;
        appearance?: Appearance;
    };

    let {
        paymentMethods,
        savedPaymentMethods = [],
        savedPaymentMethodEmail,
        collectBillingName = false,
        collectBillingAddress = false,
        appearance,
    }: Props = $props();

    const ctx = getBiasContext();
    const selectedMethod = $derived(ctx.snapshot.selectedPaymentMethod);
    const selectedSavedMethod = $derived(ctx.snapshot.selectedSavedPaymentMethod);
    const session = $derived(ctx.checkoutSession);
    const choices = $derived([
        ...savedPaymentMethods.map((method) => ({ key: method.id, kind: "saved" as const, method })),
        ...paymentMethods.map((method) => ({ key: method, kind: "new" as const, method })),
    ]);
    const selectedKey = $derived(selectedSavedMethod?.id ?? selectedMethod);

    function select(choice: (typeof choices)[number]) {
        if (choice.kind === "saved") ctx.setSavedPaymentMethod(choice.method.id);
        else ctx.setPaymentMethod(choice.method);
    }

    function handleKeydown(event: KeyboardEvent) {
        if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) return;
        event.preventDefault();

        const currentIndex = Math.max(0, choices.findIndex((choice) => choice.key === selectedKey));
        const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
        const nextIndex = (currentIndex + direction + choices.length) % choices.length;
        const next = choices[nextIndex];
        if (!next) return;

        select(next);
        const group = event.currentTarget as HTMLElement;
        queueMicrotask(() => group.querySelectorAll<HTMLElement>('[role="radio"]')[nextIndex]?.focus());
    }

    function cardBrand(brand: string | null | undefined): CardBrand {
        const normalized = brand?.trim().toLowerCase().replaceAll("_", "-").replaceAll(" ", "-");
        const aliases: Record<string, CardBrand> = {
            amex: "american-express",
            americanexpress: "american-express",
            diners: "diners-club",
            dinersclub: "diners-club",
            "master-card": "mastercard",
            "union-pay": "unionpay",
        };
        const candidate = normalized ? (aliases[normalized] ?? normalized) : undefined;
        const supported: CardBrand[] = [
            "visa",
            "mastercard",
            "maestro",
            "american-express",
            "discover",
            "diners-club",
            "jcb",
            "unionpay",
            "invalid",
        ];
        return supported.includes(candidate as CardBrand) ? (candidate as CardBrand) : "invalid";
    }

    function savedLabel(method: SavedPaymentMethod) {
        if (method.type === "card") return `•••• ${method.card?.last4 ?? ""}`;
        return `${method.us_bank_account?.bank_name ?? "Bank"} •••• ${method.us_bank_account?.last4 ?? ""}`;
    }

    function savedDetails(method: SavedPaymentMethod) {
        if (method.type === "card" && method.card) {
            const expiration = `Expires ${String(method.card.exp_month).padStart(2, "0")}/${String(method.card.exp_year).slice(-2)}`;
            return {
                            detail: method.billing_details.name?.trim() || savedPaymentMethodEmail,
                            secondaryDetail: expiration,
                        };
        }
        const accountType = method.us_bank_account?.account_type;
        return {
            detail: accountType ? `${accountType[0]?.toUpperCase()}${accountType.slice(1)}` : undefined,
        };
    }
</script>

<!-- Keyboard events bubble from the roving-tabindex radio buttons. -->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div
    class="bias-radioList 🔒 bias:rounded-[calc(var(--bias-border-radius)+2px)] bias:overflow-clip bias:shadow-(--bias-shadow)"
    role="radiogroup"
    aria-label="Payment method"
    onkeydown={handleKeydown}
>
    {#each choices as choice, index (choice.key)}
        {#if choice.kind === "saved"}
            {@const details = savedDetails(choice.method)}
            <PaymentMethodRadioOption
                label={savedLabel(choice.method)}
                detail={details.detail}
                secondaryDetail={details.secondaryDetail}
                saving={savingLabel(session, choice.method.type)}
                selected={selectedSavedMethod?.id === choice.method.id}
                first={index === 0}
                last={index === choices.length - 1}
                onselect={() => select(choice)}
            >
                {#snippet leading()}
                    {#if choice.method.type === "card"}
                        <CardIcon brand={cardBrand(choice.method.card?.brand)} />
                    {:else}
                        <Icon src={methodConfig.us_bank_account.icon} class="🔒 bias:size-5" theme="mini" />
                    {/if}
                {/snippet}
                {#snippet content()}{/snippet}
            </PaymentMethodRadioOption>
        {:else}
            {@const config = methodConfig[choice.method]}
            <PaymentMethodRadioOption
                label={config.label}
                icon={config.icon}
                saving={savingLabel(session, choice.method)}
                selected={!selectedSavedMethod && selectedMethod === choice.method}
                first={index === 0}
                last={index === choices.length - 1}
                onselect={() => select(choice)}
            >
                {#snippet content()}
                    <PaymentMethodForm
                        method={choice.method}
                        {collectBillingName}
                        {collectBillingAddress}
                        {appearance}
                    />
                {/snippet}
            </PaymentMethodRadioOption>
        {/if}
    {/each}
</div>
