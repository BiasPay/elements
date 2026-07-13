<script lang="ts">
    import { onDestroy, untrack } from "svelte";
    import type { FrameFieldType } from "../../core";
    import { getBiasContext } from "../../context.svelte";
    import { createBiasFieldController, type FieldControllerHandle } from "../../field";
    import { cn } from "../../utils/classes";

    type Props = {
        fieldType: FrameFieldType;
        id?: string;
        placeholder?: string;
    };

    let { fieldType, id, placeholder }: Props = $props();

    const ctx = getBiasContext();

    const CSS_VARS = [
        "--bias-color-foreground",
        "--bias-font-family",
        "--bias-font-size",
        "--bias-input-padding-inline",
    ] as const;

    const FRAME_TITLES: Record<FrameFieldType, string> = {
        cardNumber: "Card number",
        cardExpiry: "Card expiration date",
        cardCvc: "Card security code",
        bankRoutingNumber: "Bank routing number",
        bankAccountNumber: "Bank account number",
    };

    let controller = $state<FieldControllerHandle>(
        untrack(() => createBiasFieldController(fieldType, ctx)),
    );
    let sessionKey = ctx.sessionKey;
    let iframeEl = $state<HTMLIFrameElement | undefined>();
    let prevStyle = "";

    const field = $derived(ctx.fieldState[fieldType]);
    const disabled = $derived(ctx.submitDisabled);
    const showPlaceholder = $derived(!!placeholder && field?.empty !== false);

    // Recreate the controller when the session (client secret / frame url) changes.
    $effect(() => {
        const key = ctx.sessionKey;
        if (key !== sessionKey) {
            controller.destroy();
            controller = createBiasFieldController(fieldType, ctx);
            prevStyle = "";
            sessionKey = key;
        }
    });

    // Bind the iframe element to the controller once it's in the DOM.
    $effect(() => {
        controller.setIframe(iframeEl);
    });

    // Push computed CSS-variable-derived styling into the cross-origin frame
    // whenever the reactive inputs change. The inputs are passed as arguments so
    // reading them registers the effect's dependencies; getComputedStyle itself
    // is not reactive, so the CSS-variable values are read imperatively inside.
    $effect(() => {
        syncStyle(disabled, iframeEl);
    });

    function syncStyle(isDisabled: boolean, frame: HTMLIFrameElement | undefined) {
        if (!frame) return;

        const computed = getComputedStyle(frame);
        const cssVars: Record<string, string> = {};
        for (const name of CSS_VARS) {
            cssVars[name] = computed.getPropertyValue(name).trim();
        }

        const frameStyle = [
            cssVars["--bias-color-foreground"] &&
                `input { color: ${cssVars["--bias-color-foreground"]}; }`,
            cssVars["--bias-font-family"] &&
                `input { font-family: ${cssVars["--bias-font-family"]}; }`,
            cssVars["--bias-font-size"] && `input { font-size: ${cssVars["--bias-font-size"]}; }`,
            cssVars["--bias-input-padding-inline"] &&
                `input { padding-inline: ${cssVars["--bias-input-padding-inline"]}; }`,
            isDisabled && "input { opacity: 0.75 }",
        ]
            .filter(Boolean)
            .join("\n");

        if (frameStyle !== prevStyle) {
            prevStyle = frameStyle;
            controller.setStyle(frameStyle);
        }
    }

    onDestroy(() => controller.destroy());
</script>

<div class="bias-fieldFrame 🔒 bias:contents">
    <span
        class={cn(
            "bias-fieldPlaceholder 🔒 bias:absolute bias:inset-0 bias:z-10 bias:flex bias:items-center bias:h-full bias:px-(--bias-input-padding-inline) bias:text-(length:--bias-font-size) bias:pointer-events-none bias:text-(--bias-color-placeholder)",
            !showPlaceholder && "bias:hidden",
        )}
        style="font-family: var(--bias-font-family);"
            aria-hidden="true"
        >
        {placeholder}
    </span>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <iframe
        {id}
        bind:this={iframeEl}
        src={controller.iframeSrc}
        title={FRAME_TITLES[fieldType]}
        class={cn("🔒 bias:absolute bias:inset-0 bias:w-full bias:h-full bias:border-none", disabled && "bias:pointer-events-none")}
        aria-disabled={disabled ? "true" : undefined}
        scrolling="no"
        tabindex={disabled ? -1 : undefined}
        onload={() => controller.handleIframeLoad()}
    ></iframe>
</div>
