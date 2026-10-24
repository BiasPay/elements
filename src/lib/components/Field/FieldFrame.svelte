<script lang="ts">
    import { onDestroy, untrack } from "svelte";
    import type { FrameFieldType } from "~/core";
    import { getAppearanceAccessor, getBiasContext } from "~/context.svelte";
    import { createBiasFieldController, type FieldControllerHandle } from "~/field";
    import { cn } from "~/utils/classes";
    import { buildFieldFrameStyle, FIELD_FRAME_CSS_VARS } from "./fieldFrameStyle";

    type Props = {
        fieldType: FrameFieldType;
        id?: string;
        placeholder?: string;
        floatingLabelShrunk?: boolean;
    };

    let { fieldType, id, placeholder, floatingLabelShrunk = false }: Props = $props();

    const ctx = getBiasContext();
    const appearance = getAppearanceAccessor();

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
    let prevPlaceholder: string | undefined;

    const disabled = $derived(ctx.submitDisabled);

    // Recreate the controller when the session (client secret / frame url) changes.
    $effect(() => {
        const key = ctx.sessionKey;
        if (key !== sessionKey) {
            controller.destroy();
            controller = createBiasFieldController(fieldType, ctx);
            prevStyle = "";
            prevPlaceholder = undefined;
            sessionKey = key;
        }
    });

    // Bind the iframe element to the controller once it's in the DOM.
    $effect(() => {
        controller.setIframe(iframeEl);
    });

    // Push presentation into the cross-origin frame whenever its reactive inputs
    // change. Style is sent before placeholder text so a newly loaded field never
    // paints an unpadded placeholder. The first style also skips animation; later
    // updates retain the normal padding transition. Colors are read from computed
    // CSS variables, which aren't reactive, so appearance changes re-sync too.
    $effect(() => {
        appearance();
        syncPresentation(disabled, floatingLabelShrunk, placeholder, iframeEl);
    });

    function syncPresentation(
        isDisabled: boolean,
        isFloatingLabelShrunk: boolean,
        nextPlaceholder: string | undefined,
        frame: HTMLIFrameElement | undefined,
    ) {
        if (!frame) return;

        const computed = getComputedStyle(frame);
        const cssVars = {} as Record<(typeof FIELD_FRAME_CSS_VARS)[number], string>;
        for (const name of FIELD_FRAME_CSS_VARS) {
            cssVars[name] = computed.getPropertyValue(name).trim();
        }

        const frameStyle = buildFieldFrameStyle({
            cssVars,
            disabled: isDisabled,
            floatingLabelShrunk: isFloatingLabelShrunk,
            animatePadding: prevStyle !== "",
        });

        if (frameStyle !== prevStyle) {
            prevStyle = frameStyle;
            controller.setStyle(frameStyle);
        }

        const resolvedPlaceholder = nextPlaceholder ?? "";
        if (resolvedPlaceholder !== prevPlaceholder) {
            prevPlaceholder = resolvedPlaceholder;
            controller.setPlaceholder(resolvedPlaceholder);
        }
    }

    onDestroy(() => controller.destroy());
</script>

<div class="bias-fieldFrame 🔒 bias:contents">
    <!-- A field document accepts a single private channel, so each controller (one per
         session) gets its own iframe document even when the frame URL is unchanged. -->
    {#key controller}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <iframe
            {id}
            bind:this={iframeEl}
            src={controller.iframeSrc}
            title={FRAME_TITLES[fieldType]}
            referrerpolicy="origin"
            class={cn(
                "🔒 bias:absolute bias:inset-0 bias:w-full bias:h-full bias:rounded-bias bias:border-none",
                disabled && "bias:pointer-events-none",
            )}
            aria-disabled={disabled ? "true" : undefined}
            scrolling="no"
            tabindex={disabled ? -1 : undefined}
            onload={() => controller.handleIframeLoad()}
        ></iframe>
    {/key}
</div>
