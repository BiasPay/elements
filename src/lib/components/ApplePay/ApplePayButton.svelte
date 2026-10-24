<script lang="ts">
    import type { ApplePayWalletConfig } from "~/core";
    import { getBiasContext } from "~/context.svelte";
    import {
        applePayButtonType,
        applePayTotal,
        buildApplePayRequest,
        nativeApplePayShippingMethods,
        nativeApplePayUpdate,
        selectApplePaySessionVersion,
        type ApplePaySessionInstance,
    } from "./apple-pay";

    type Props = {
        showSeparator?: boolean;
        disabled?: boolean;
    };

    let { showSeparator = false, disabled: disabledProp = false }: Props = $props();

    const ctx = getBiasContext();
    let button = $state<HTMLButtonElement>();
    let preparation = $state<{ config: ApplePayWalletConfig; version: number }>();
    let activeSession: ApplePaySessionInstance | undefined;
    let authorizationStarted = false;
    let activeRequest: AbortController | undefined;
    let sheetUpdateSequence = 0;

    const session = $derived(ctx.checkoutSession);
    const enabledForSession = $derived(
        session?.payment_method_types.includes("apple_pay") === true,
    );
    const preparationKey = $derived(
        enabledForSession ? `${ctx.sessionKey}:${session?.id ?? ""}` : "disabled",
    );
    const available = $derived(
        preparation !== undefined && ctx.publicState.walletAvailability.applePay === "available",
    );
    const disabled = $derived(disabledProp || ctx.submitDisabled);
    const buttonType = $derived(applePayButtonType(session?.submit_label, session?.mode));

    function restoreFocus() {
        queueMicrotask(() => button?.focus());
    }

    function clearActive() {
        activeSession = undefined;
        activeRequest = undefined;
        sheetUpdateSequence++;
        authorizationStarted = false;
    }

    function closeActive(options: { fail?: string | true } = {}) {
        const walletSession = activeSession;
        const submissionStarted = authorizationStarted;
        activeRequest?.abort();
        clearActive();
        try {
            walletSession?.abort();
        } catch {
            // The native sheet may already be closed.
        }
        if (!submissionStarted && options.fail) {
            ctx.failApplePayPresentation(
                typeof options.fail === "string" ? options.fail : undefined,
            );
        }
    }

    $effect(() => {
        const ownerKey = preparationKey;
        const request = new AbortController();
        preparation = undefined;
        ctx.setWalletAvailability(enabledForSession ? "loading" : "unavailable");
        if (enabledForSession) {
            void Promise.all([
                ctx.prepareApplePay(request.signal),
                selectApplePaySessionVersion(),
            ]).then(([prepared, version]) => {
                if (request.signal.aborted || preparationKey !== ownerKey) return;
                if (prepared && version !== null) {
                    preparation = { config: prepared, version };
                    ctx.setWalletAvailability("available");
                } else {
                    ctx.setWalletAvailability("unavailable");
                }
            });
        }
        return () => {
            request.abort();
            preparation = undefined;
            if (activeSession) closeActive({ fail: true });
        };
    });

    function present(event: MouseEvent) {
        event.preventDefault();
        const prepared = preparation;
        if (disabled || activeSession || !prepared || !globalThis.ApplePaySession) return;

        const presentation = ctx.beginApplePayPresentation();
        if (!presentation) return;

        let walletSession: ApplePaySessionInstance;
        try {
            walletSession = new globalThis.ApplePaySession(
                prepared.version,
                buildApplePayRequest(presentation),
            );
            activeSession = walletSession;
            authorizationStarted = false;
            activeRequest = new AbortController();
            sheetUpdateSequence = 0;

            walletSession.onvalidatemerchant = ({ validationURL }) => {
                void ctx
                    .validateApplePayMerchant(presentation, validationURL, activeRequest?.signal)
                    .then((merchantSession) => {
                        if (activeSession === walletSession) {
                            walletSession.completeMerchantValidation(merchantSession);
                        }
                    })
                    .catch(() => {
                        if (activeSession !== walletSession) return;
                        closeActive({
                            fail: "Apple Pay could not be validated. Please try again.",
                        });
                        restoreFocus();
                    });
            };

            walletSession.onshippingcontactselected = ({ shippingContact }) => {
                const updateSequence = ++sheetUpdateSequence;
                void ctx
                    .updateApplePayShippingContact(
                        presentation,
                        shippingContact,
                        activeRequest?.signal,
                    )
                    .then((update) => {
                        if (
                            activeSession !== walletSession ||
                            activeRequest?.signal.aborted ||
                            sheetUpdateSequence !== updateSequence
                        )
                            return;
                        const nativeUpdate = nativeApplePayUpdate(presentation, update);
                        walletSession.completeShippingContactSelection(
                            globalThis.ApplePaySession?.STATUS_SUCCESS ?? 1,
                            nativeUpdate.shippingMethods,
                            nativeUpdate.total,
                            nativeUpdate.lineItems,
                        );
                    })
                    .catch(() => {
                        if (
                            activeSession !== walletSession ||
                            activeRequest?.signal.aborted ||
                            sheetUpdateSequence !== updateSequence
                        )
                            return;
                        if (ctx.publicState.status !== "presenting_wallet") {
                            closeActive();
                            restoreFocus();
                            return;
                        }
                        walletSession.completeShippingContactSelection(
                            globalThis.ApplePaySession?.STATUS_INVALID_SHIPPING_POSTAL_ADDRESS ??
                                globalThis.ApplePaySession?.STATUS_FAILURE ??
                                0,
                            nativeApplePayShippingMethods(presentation.shippingMethods),
                            applePayTotal(presentation, presentation.amount),
                            [],
                        );
                    });
            };

            walletSession.onshippingmethodselected = ({ shippingMethod }) => {
                const updateSequence = ++sheetUpdateSequence;
                void ctx
                    .updateApplePayShippingMethod(
                        presentation,
                        shippingMethod.identifier,
                        activeRequest?.signal,
                    )
                    .then((update) => {
                        if (
                            activeSession !== walletSession ||
                            activeRequest?.signal.aborted ||
                            sheetUpdateSequence !== updateSequence
                        )
                            return;
                        const nativeUpdate = nativeApplePayUpdate(presentation, update);
                        walletSession.completeShippingMethodSelection(
                            globalThis.ApplePaySession?.STATUS_SUCCESS ?? 1,
                            nativeUpdate.total,
                            nativeUpdate.lineItems,
                        );
                    })
                    .catch(() => {
                        if (
                            activeSession !== walletSession ||
                            activeRequest?.signal.aborted ||
                            sheetUpdateSequence !== updateSequence
                        )
                            return;
                        if (ctx.publicState.status !== "presenting_wallet") {
                            closeActive();
                            restoreFocus();
                            return;
                        }
                        walletSession.completeShippingMethodSelection(
                            globalThis.ApplePaySession?.STATUS_FAILURE ?? 0,
                            applePayTotal(presentation, presentation.amount),
                            [],
                        );
                    });
            };

            walletSession.onpaymentauthorized = (authorizedEvent) => {
                if (activeSession !== walletSession || authorizationStarted) return;
                authorizationStarted = true;
                sheetUpdateSequence++;
                const { paymentData } = authorizedEvent.payment.token;
                void ctx
                    .authorizeApplePay(
                        presentation,
                        paymentData,
                        authorizedEvent.payment.billingContact,
                        authorizedEvent.payment.shippingContact,
                        activeRequest?.signal,
                    )
                    .then((result) => {
                        if (activeSession !== walletSession) return;
                        walletSession.completePayment(
                            result === "success"
                                ? globalThis.ApplePaySession?.STATUS_SUCCESS ?? 1
                                : globalThis.ApplePaySession?.STATUS_FAILURE ?? 0,
                        );
                        clearActive();
                    });
            };

            walletSession.oncancel = () => {
                if (activeSession !== walletSession) return;
                closeActive();
                ctx.cancelApplePayPresentation();
                restoreFocus();
            };

            walletSession.begin();
        } catch {
            closeActive({ fail: "Apple Pay could not be opened. Please try again." });
            restoreFocus();
        }
    }
</script>

{#if available}
    <div class="bias-expressCheckoutHeading 🔒 bias:mb-4 bias:text-center bias:text-sm bias:leading-none bias:text-muted-foreground">
        Express checkout
    </div>
    <button
        bind:this={button}
        type="button"
        class="bias-applePayButton 🔒 apple-pay-{buttonType} bias:m-0 bias:block bias:h-12 bias:min-h-12 bias:w-full bias:min-w-[140px] bias:box-border bias:cursor-pointer bias:rounded-bias bias:border-0 bias:px-0 bias:py-0.5 bias:disabled:cursor-default bias:disabled:opacity-55 bias:focus-visible:outline-[var(--bias-focus-ring-width,3px)] bias:focus-visible:[outline-color:var(--bias-focus-ring-color,color-mix(in_srgb,var(--bias-color-primary)_30%,transparent))] bias:focus-visible:outline-offset-2"
        aria-label="{buttonType[0]?.toUpperCase()}{buttonType.slice(1)} with Apple Pay"
        {disabled}
        onclick={present}
    ></button>
    {#if showSeparator}
        <div
            class="bias-expressCheckoutSeparator 🔒 bias:mt-5.5 bias:-mb-1.5 bias:grid bias:w-full bias:grid-cols-[1fr_auto_1fr] bias:items-center bias:gap-(--bias-gap) bias:text-center bias:text-sm bias:leading-none bias:text-muted-foreground"
            role="separator"
            aria-label="or"
        >
            <span class="🔒 bias:h-px bias:bg-border"></span><span>or</span
            ><span class="🔒 bias:h-px bias:bg-border"></span>
        </div>
    {/if}
{/if}

<style>
    .bias-applePayButton {
        -webkit-appearance: -apple-pay-button;
        appearance: -apple-pay-button;
        -apple-pay-button-style: black;
        -apple-pay-button-type: pay;
    }

    .bias-applePayButton.apple-pay-book {
        -apple-pay-button-type: book;
    }

    .bias-applePayButton.apple-pay-donate {
        -apple-pay-button-type: donate;
    }

    .bias-applePayButton.apple-pay-subscribe {
        -apple-pay-button-type: subscribe;
    }

</style>
