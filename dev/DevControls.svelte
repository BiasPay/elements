<script lang="ts">
    import { Pane, Folder, List, RadioGrid, Checkbox, Monitor, Separator } from "svelte-tweakpane-ui";
    import type { CheckoutSession } from "@biaspay/sdk";
    import type { LabelStyle } from "~/core";
    import type { SessionPreset } from "./createSession.ts";

    export type DevView = "payment-form" | "card-form" | "bank-account-form" | "address-form";

    type Props = {
        view: DevView;
        labelStyle: LabelStyle | undefined;
        listStyle: "tabs" | "radio";
        cardEnabled: boolean;
        bankEnabled: boolean;
        addressEnabled: boolean;
        shippingEnabled: boolean;
        collectPhone: boolean;
        sessionPreset: SessionPreset;
        submitLabel: NonNullable<CheckoutSession["submit_label"]>;
        useMockSession: boolean;
        sessionLoading: boolean;
        sessionError: string | undefined;
    };

    let {
        view = $bindable(),
        labelStyle = $bindable(),
        listStyle = $bindable(),
        cardEnabled = $bindable(),
        bankEnabled = $bindable(),
        addressEnabled = $bindable(),
        shippingEnabled = $bindable(),
        collectPhone = $bindable(),
        sessionPreset = $bindable(),
        submitLabel = $bindable(),
        useMockSession,
        sessionLoading,
        sessionError,
    }: Props = $props();

    const VIEW_OPTIONS = {
        Combined: "payment-form",
        Card: "card-form",
        Bank: "bank-account-form",
        Address: "address-form",
    } satisfies Record<string, DevView>;

    const LABEL_STYLE_OPTIONS = {
        Static: "static",
        Floating: "floating",
        Placeholder: "placeholder",
    } satisfies Record<string, LabelStyle>;

    const LIST_STYLE_OPTIONS = {
        Tabs: "tabs",
        Radio: "radio",
    } satisfies Record<string, "tabs" | "radio">;

    const SESSION_PRESET_OPTIONS = {
        Default: "default",
        Dual: "dual-pricing",
        Setup: "setup",
    } satisfies Record<string, SessionPreset>;

    const SUBMIT_LABEL_OPTIONS = ["pay", "donate", "book", "subscribe", "auto"] as const;

    // List reads/writes a plain value; map the "unset" label style to "static"
    // for the control and back to `undefined` on change.
    let labelStyleValue = $state<LabelStyle>(labelStyle ?? "static");
    $effect(() => {
        labelStyleValue = labelStyle ?? "static";
    });
    $effect(() => {
        labelStyle = labelStyleValue === "static" ? undefined : labelStyleValue;
    });

    const paymentMethodCount = $derived((cardEnabled ? 1 : 0) + (bankEnabled ? 1 : 0));
    const showPaymentMethodControls = $derived(view === "payment-form");
    const showListStyle = $derived(showPaymentMethodControls && paymentMethodCount > 1);

    const sessionStatus = $derived(
        useMockSession
            ? "Mock (set VITE_BIAS_API_KEY for live)"
            : sessionError
              ? sessionError
              : sessionLoading
                ? "Refreshing…"
                : "Live",
    );

    function onCardChange(next: boolean) {
        if (!next && !bankEnabled) return;
        cardEnabled = next;
    }

    function onBankChange(next: boolean) {
        if (!next && !cardEnabled) return;
        bankEnabled = next;
    }
</script>

<Pane title="Bias Elements (Svelte)" position="fixed">
    <Monitor value={sessionStatus} label="Session" />

    <Folder title="Component" expanded>
        <RadioGrid bind:value={view} values={Object.values(VIEW_OPTIONS)} columns={2} />
    </Folder>

    <Folder title="Label style">
        <List bind:value={labelStyleValue} options={LABEL_STYLE_OPTIONS} />
    </Folder>

    <Folder title="Address element">
        {#if view !== "address-form"}
            <Checkbox bind:value={addressEnabled} label="Billing address" />
            <Checkbox bind:value={shippingEnabled} label="Shipping address" />
        {/if}
        {#if view === "address-form" || addressEnabled}
            <Checkbox bind:value={collectPhone} label="Collect phone" />
        {/if}
    </Folder>

    {#if showPaymentMethodControls}
        <Folder title="Payment methods">
            <Checkbox value={cardEnabled} on:change={(e) => onCardChange(e.detail.value)} label="Card" />
            <Checkbox
                value={bankEnabled}
                on:change={(e) => onBankChange(e.detail.value)}
                label="US bank account"
            />
        </Folder>
    {/if}

    {#if showListStyle}
        <Folder title="Method picker">
            <List bind:value={listStyle} options={LIST_STYLE_OPTIONS} />
        </Folder>
    {/if}

    <Folder title="Session" expanded>
        <List bind:value={sessionPreset} label="Preset" options={SESSION_PRESET_OPTIONS} />
        {#if sessionPreset === "setup"}
            <Separator />
            <Monitor value="auto (fixed by setup mode)" label="Submit label" />
        {:else}
            <List bind:value={submitLabel} label="Submit label" options={SUBMIT_LABEL_OPTIONS} />
        {/if}
    </Folder>
</Pane>
