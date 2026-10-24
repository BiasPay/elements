<script lang="ts">
    import { Tag, XMark } from "@steeze-ui/heroicons";
    import type { AppliedDiscount, CheckoutSession } from "@biaspay/sdk";
    import { onDestroy } from "svelte";
    import type { Appearance } from "~/core";
    import { isEnteredDiscountCode } from "~/core/discounts";
    import { getBiasContext } from "~/context.svelte";
    import { appearance as appearanceAction } from "~/utils/appearance";
    import { cn } from "~/utils/classes";
    import { collapse, easeInOutSmooth, fadeScale } from "~/utils/transitions";
    import FieldShell from "../Field/FieldShell.svelte";
    import FieldGroupBase from "../FieldGroup/FieldGroupBase.svelte";
    import Icon from "../Icon/Icon.svelte";
    import Spinner from "../SubmitButton/Spinner.svelte";

    type Props = {
        appearance?: Appearance;
        onDiscountCodeChange?: (session: CheckoutSession) => void | Promise<void>;
    };

    let { appearance, onDiscountCodeChange }: Props = $props();

    const ctx = getBiasContext();
    let code = $state("");
    let form: HTMLFormElement | undefined = $state();
    let inputElement: HTMLInputElement | undefined = $state();
    let focused = $state(false);
    let shake: Animation | undefined;
    onDestroy(() => shake?.cancel());

    const discountState = $derived(ctx.publicState.discountCodeState);
    const inputBlocked = $derived(
        discountState.pendingAction === "apply" ||
            ctx.publicState.status === "presenting_wallet" ||
            ctx.publicState.status === "submitting" ||
            ctx.publicState.status === "processing" ||
            ctx.publicState.status === "succeeded",
    );
    const session = $derived(ctx.checkoutSession);
    const allowChanges = $derived(session?.allow_discount_codes === true);
    const removedIds = $derived(new Set(discountState.optimisticallyRemovedDiscountIds));
    const discounts = $derived.by(() => {
        const visible = (session?.discounts ?? []).filter(
            (discount) => isEnteredDiscountCode(discount) && !removedIds.has(discount.id),
        );
        return visible.filter(
            (discount, index) =>
                visible.findIndex(
                    (candidate) =>
                        discountCodeLabel(candidate).toLocaleUpperCase() ===
                        discountCodeLabel(discount).toLocaleUpperCase(),
                ) === index,
        );
    });
    const visible = $derived(allowChanges || discounts.length > 0);

    function discountCodeLabel(discount: AppliedDiscount): string {
        return discount.code ?? discount.name;
    }

    function reject() {
        queueMicrotask(() => {
            inputElement?.focus({ preventScroll: true });
            inputElement?.select();
        });
        if (!form || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        shake?.cancel();
        shake = form.animate(
            [
                { translate: "0" },
                { translate: "-5px" },
                { translate: "4px" },
                { translate: "-2px" },
                { translate: "1px" },
                { translate: "0" },
            ],
            { duration: 360, easing: "ease-out" },
        );
    }

    async function apply(event: SubmitEvent) {
        event.preventDefault();
        const applied = await ctx.applyDiscountCode(code, onDiscountCodeChange);
        if (applied) code = "";
        else reject();
    }

    async function remove(discountId: string) {
        await ctx.removeDiscountCode(discountId, onDiscountCodeChange);
    }
</script>

{#if visible}
    <div
        aria-busy={discountState.pendingAction ? "true" : undefined}
        class="bias-discountCodeElement bias-form 🔒 bias:flex bias:flex-col"
        use:appearanceAction={appearance}
    >
        {#if allowChanges}
            <form bind:this={form} onsubmit={apply}>
                <FieldGroupBase
                    label="Discount code"
                    fieldName="discountCode"
                    filled={Boolean(code)}
                    {appearance}
                    error={discountState.error}
                >
                    {#snippet input(placeholder, id, ariaDescribedby)}
                        <div
                            class="discountCodeInputRow 🔒 bias:col-span-full bias:grid bias:grid-cols-subgrid"
                        >
                            <div class="🔒 bias:min-w-0 bias:flex-1">
                                <FieldShell
                                    class="🔒 bias:h-12"
                                    {focused}
                                    error={discountState.error}
                                    disabled={inputBlocked}
                                >
                                    <input
                                        bind:this={inputElement}
                                        bind:value={code}
                                        {id}
                                        type="text"
                                        data-bias-hostField
                                        {placeholder}
                                        aria-describedby={ariaDescribedby}
                                        aria-invalid={discountState.error ? "true" : undefined}
                                        autocomplete="off"
                                        autocapitalize="characters"
                                        spellcheck="false"
                                        maxlength="64"
                                        disabled={inputBlocked}
                                        class="bias-hostField"
                                        oninput={() => ctx.clearDiscountCodeError()}
                                        onfocus={() => (focused = true)}
                                        onblur={() => (focused = false)}
                                    />
                                </FieldShell>
                            </div>
                            <button
                                type="submit"
                                disabled={discountState.blocked || !code.trim()}
                                class={cn(
                                    "bias-discountCodeApply 🔒",
                                    "bias:grid bias:h-12 bias:min-w-20 bias:shrink-0 bias:cursor-pointer bias:place-items-center bias:rounded-bias bias:border bias:border-primary bias:bg-primary bias:px-4 bias:text-sm bias:font-medium bias:text-white bias:shadow-(--bias-shadow) bias:transition-[background-color,border-color,color,opacity] bias:enabled:hover:opacity-85 bias:disabled:cursor-default",
                                    discountState.pendingAction !== "apply" &&
                                        "bias:disabled:border-border bias:disabled:bg-input bias:disabled:text-muted-foreground bias:disabled:opacity-60",
                                )}
                            >
                                {#if discountState.pendingAction === "apply"}
                                    <span
                                        class="🔒 bias:col-start-1 bias:row-start-1 bias:grid bias:size-6 bias:place-items-center"
                                        transition:fadeScale={{
                                            scale: 0.78,
                                            blur: 2,
                                            duration: 180,
                                        }}
                                    >
                                        <Spinner />
                                    </span>
                                {:else}
                                    <span
                                        class="🔒 bias:col-start-1 bias:row-start-1"
                                        transition:fadeScale={{
                                            scale: 0.86,
                                            blur: 2,
                                            duration: 180,
                                        }}
                                    >
                                        Apply
                                    </span>
                                {/if}
                            </button>
                        </div>
                    {/snippet}
                </FieldGroupBase>
            </form>
        {/if}

        {#if discounts.length > 0}
            <ul
                aria-label="Applied discount codes"
                class="🔒 bias:flex bias:flex-wrap bias:gap-2 bias:pt-3"
                transition:collapse={{
                    duration: 400,
                    opacity: 0,
                    translate: "0 -4px",
                    easing: easeInOutSmooth,
                }}
            >
                {#each discounts as discount (discount.id)}
                    <li
                        class="bias-discountCodePill 🔒 bias:flex bias:max-w-full bias:items-center bias:gap-1.5 bias:text-base bias:rounded-bias bias:bg-[color-mix(in_srgb,var(--bias-color-foreground)_6%,transparent)] bias:py-1 bias:pr-1 bias:pl-2 bias:text-foreground"
                    >
                        <div class="🔒 bias:flex bias:min-w-0 bias:items-center bias:gap-1.5">
                            <Icon
                                src={Tag}
                                theme="micro"
                                class="🔒 bias:size-4 bias:shrink-0 bias:opacity-60"
                            />
                            <span class="🔒 bias:truncate">{discountCodeLabel(discount)}</span>
                        </div>
                        {#if allowChanges}
                            <button
                                type="button"
                                onclick={() => void remove(discount.id)}
                                disabled={discountState.blocked}
                                aria-label={`Remove discount code ${discountCodeLabel(discount)}`}
                                class="bias-discountCodeRemove 🔒 bias:grid bias:size-6 bias:shrink-0 bias:cursor-pointer bias:place-items-center bias:rounded-[calc(var(--bias-border-radius)*0.75)] bias:border-0 bias:bg-transparent bias:p-0 bias:text-current bias:opacity-55 bias:transition-[background-color,opacity] bias:hover:bg-[color-mix(in_srgb,var(--bias-color-foreground)_7%,transparent)] bias:hover:opacity-90 bias:disabled:cursor-default bias:disabled:opacity-35"
                            >
                                <Icon src={XMark} theme="mini" class="🔒 bias:size-4" />
                            </button>
                        {/if}
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
{/if}

<style>
    form :global(.bias-fieldGroup) {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        column-gap: 0.5rem;
    }

    form :global(.bias-fieldGroup > .bias-formLabel),
    form :global(.bias-floatingLabel) {
        grid-column: 1 / -1;
    }

    form :global(.bias-floatingLabel) {
        display: grid;
        grid-template-columns: subgrid;
    }

    form :global(.bias-formError) {
        grid-column: 1;
    }
</style>
