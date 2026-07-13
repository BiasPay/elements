<script lang="ts">
    import { getBiasContext } from "~/context.svelte";
    import { cn } from "~/utils/classes";
    import { collapse, fadeScale } from "~/utils/transitions";
    import Spinner from "./Spinner.svelte";
    import CheckCircle from "./CheckCircle.svelte";
    import LockIcon from "./LockIcon.svelte";

    type Props = {
        disabled?: boolean;
        label?: string;
    };

    let { disabled = false, label }: Props = $props();

    const ctx = getBiasContext();
    const CURRENCY = "USD";

    let shimmer = $state(true);

    const s = $derived(ctx.snapshot);
    const loading = $derived(s.submitLoading);
    const success = $derived(s.submitSuccess);
    const session = $derived(ctx.checkoutSession);
    const notReady = $derived(disabled || !ctx.isSubmittable);

    const LABELS = {
        book: "Book",
        donate: "Donate",
        pay: "Pay",
        subscribe: "Subscribe",
        setup: "Continue",
    } as const;
    type SubmitIntent = keyof typeof LABELS;

    /** Intents that display the charge amount next to the label. */
    const AMOUNT_INTENTS: SubmitIntent[] = ["pay", "donate"];

    const intent = $derived.by<SubmitIntent>(() => {
        const submit = session?.submit_label ?? "pay";
        if (submit === "auto") return session?.mode === "setup" ? "setup" : "pay";
        return submit in LABELS ? (submit as SubmitIntent) : "pay";
    });

    const buttonText = $derived(LABELS[intent]);

    const amount = $derived.by(() => {
        if (!session) return undefined;
        if (s.selectedPaymentMethod !== "card" || !session.dual_pricing) {
            return session.amount;
        }
        return session.amount + Math.round((session.amount * session.dual_pricing.rate) / 100);
    });

    const showAmount = $derived(
        amount !== undefined && !notReady && !success && AMOUNT_INTENTS.includes(intent),
    );
    const formattedAmount = $derived(
        amount === undefined
            ? undefined
            : (amount / 100).toLocaleString("en-US", {
                  style: "currency",
                  currency: CURRENCY,
              }),
    );
    const ariaLabel = $derived(
        loading ? "Processing…" : success ? "Payment received" : buttonText,
    );

    function handleClick(event: Event) {
        event.preventDefault();
        if (disabled || loading || success) return;
        shimmer = false;
        ctx.attemptPayment();
    }
</script>

<div class="bias-submitButton 🔒 wrapper bias:mt-1 bias:mb-2 bias:transition-opacity bias:duration-200">
    <button
        type="submit"
        aria-label={ariaLabel}
        onclick={handleClick}
        disabled={disabled || loading || success}
        data-disabled={notReady && !success ? "" : undefined}
        class={cn(
            "bias-button 🔒 button",
            "bias:relative bias:grid bias:h-12 bias:w-full bias:items-center bias:rounded-(--bias-border-radius) bias:border-none bias:font-[inherit] bias:text-base bias:text-[color:var(--bias-button-color,#fff)] bias:cursor-pointer bias:outline-none bias:transition-[scale,opacity,background-color] bias:duration-100 bias:active:scale-[0.993] bias:active:opacity-[0.96] bias:disabled:cursor-default",
            success ? "bias:bg-(--bias-color-success)" : "bias:bg-(--bias-color-primary)",
            shimmer && !notReady && !loading && !success && "buttonShimmer",
        )}
    >
        <div
            class={cn(
                "🔒 cell",
                "bias:col-start-1 bias:row-start-1 bias:flex bias:items-center bias:justify-center bias:transition-opacity bias:duration-200",
                notReady && !success && "bias:opacity-60",
            )}
        >
            {#if loading || success}
                <div
                    class="🔒 bias:pr-1"
                    transition:collapse={{ axis: "x", opacity: 0, scale: 0.75, duration: 300 }}
                >
                    <div class="🔒 bias:grid bias:place-items-center">
                        {#if loading}<div class="🔒 bias:col-start-1 bias:row-start-1 bias:grid bias:min-w-0 bias:place-items-center"><Spinner /></div>{/if}
                        {#if success}<div class="🔒 bias:col-start-1 bias:row-start-1 bias:grid bias:min-w-0 bias:place-items-center"><CheckCircle /></div>{/if}
                    </div>
                </div>
            {/if}
            {#if !success}
                <span transition:collapse={{ axis: "x", opacity: 0, scale: 0.75, duration: 300 }}>
                    <span
                        class="bias-buttonLabel 🔒 bias:flex bias:min-w-0 bias:font-medium bias:transition-opacity bias:duration-200"
                    >
                        {label ?? buttonText}
                        {#if showAmount}
                            <span transition:collapse={{ axis: "x", opacity: 0, duration: 300 }}>
                                <span class="bias-buttonAmount 🔒 bias:min-w-0 bias:origin-left bias:whitespace-nowrap"
                                    >&nbsp;{formattedAmount}</span
                                >
                            </span>
                        {/if}
                    </span>
                </span>
            {/if}
        </div>

        <div
            class="bias-lock 🔒 lockCell bias:col-start-1 bias:row-start-1 bias:flex bias:items-center bias:justify-end bias:pr-3.5 bias:pointer-events-none"
        >
            {#if !notReady && !success}
                <div transition:fadeScale={{ scale: 0.85, duration: 200 }}>
                    <LockIcon />
                </div>
            {/if}
        </div>
    </button>
</div>

<style>
    @keyframes shimmer {
        0% {
            background-position: 200% center;
        }
        50% {
            background-position: -200% center;
        }
        50.01% {
            background-position: 200% center;
        }
        100% {
            background-position: 200% center;
        }
    }

    .wrapper {
        container-type: inline-size;
    }

    .button::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: var(--bias-border-radius);
        box-shadow: var(--bias-shadow);
        transition: box-shadow 0.25s;
        background-image: linear-gradient(
            100deg,
            transparent 22.5%,
            color-mix(in srgb, transparent, var(--bias-button-color, #fff) 13%) 50%,
            transparent 77.5%
        );
        background-size: 200% 100%;
        background-repeat: no-repeat;
        background-position: 200% center;
        pointer-events: none;
    }

    .button:focus-visible {
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--bias-color-primary) 25%, transparent);
    }

    .button:hover:not(:disabled):not([data-disabled])::after {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    }

    .buttonShimmer::after {
        animation: shimmer 3s linear infinite;
    }

    @container (max-width: 220px) {
        .lockCell {
            display: none;
        }
    }
</style>
