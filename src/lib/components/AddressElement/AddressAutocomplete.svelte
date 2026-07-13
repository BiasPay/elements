<script lang="ts">
    import { onDestroy } from "svelte";
    import { MagnifyingGlass, XMark } from "@steeze-ui/heroicons";
    import type { AddressAutocompleteSuggestion } from "@biaspay/sdk";
    import { getAddressScope, getBiasContext } from "~/context.svelte";
    import { cn } from "~/utils/classes";
    import Icon from "../Icon/Icon.svelte";
    import FieldShell from "../Field/FieldShell.svelte";

    const DEBOUNCE_MS = 250;
    const MIN_INPUT_LENGTH = 3;

    type Props = {
        id?: string;
        placeholder?: string;
        /** Notifies an ancestor `AddressElement` that the full address form should be shown. */
        onreveal?: () => void;
    };

    let { id, placeholder, onreveal }: Props = $props();

    const ctx = getBiasContext();
    const scope = $derived(getAddressScope());

    let suggestions = $state<AddressAutocompleteSuggestion[]>([]);
    let open = $state(false);
    /** Input value the current `suggestions` were fetched for; used to bold the matched text. */
    let query = $state("");
    let activeIndex = $state(-1);

    const instanceId = $props.id();
    const listboxId = `bias-addressSuggestions-${instanceId}`;
    const anchorName = `--bias-addressAnchor-${instanceId}`;

    let panelEl = $state<HTMLDivElement>();

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let abortController: AbortController | undefined;
    /** Guards against a stale response landing after a newer request started. */
    let requestToken = 0;

    const disabled = $derived(ctx.submitDisabled);
    const field = $derived(ctx.getField(scope, "addressLine1"));
    const showListbox = $derived(open && suggestions.length > 0);
    const activeId = $derived(
        activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined,
    );

    // Drive the manual popover open/close state.
    $effect(() => {
        if (!panelEl) return;
        if (open && suggestions.length > 0) {
            if (!panelEl.matches(":popover-open")) panelEl.showPopover();
        } else if (panelEl.matches(":popover-open")) {
            panelEl.hidePopover();
        }
    });

    onDestroy(() => {
        clearTimeout(debounceTimer);
        abortController?.abort();
    });

    function close() {
        open = false;
        activeIndex = -1;
        suggestions = [];
        query = "";
    }

    function scheduleSearch(input: string) {
        clearTimeout(debounceTimer);
        abortController?.abort();

        if (input.trim().length < MIN_INPUT_LENGTH) {
            close();
            return;
        }

        // Keep any existing suggestions visible (no flash) until the new ones land.
        debounceTimer = setTimeout(() => void search(input), DEBOUNCE_MS);
    }

    async function search(input: string) {
        const token = ++requestToken;
        const controller = new AbortController();
        abortController = controller;

        const country = ctx.getField(scope, "country").value || undefined;
        const result = await ctx.autocompleteAddress(input, country, controller.signal);

        if (token !== requestToken) return;

        query = input;
        suggestions = result;
        open = result.length > 0;
        activeIndex = result.length > 0 ? 0 : -1;
    }

    /** Bolds the portion of `text` that matches the current query, if any. */
    function highlightMatch(text: string): { before: string; match: string; after: string } | null {
        const q = query.trim();
        if (!q) return null;

        const index = text.toLowerCase().indexOf(q.toLowerCase());
        if (index === -1) return null;

        return {
            before: text.slice(0, index),
            match: text.slice(index, index + q.length),
            after: text.slice(index + q.length),
        };
    }

    function selectSuggestion(suggestion: AddressAutocompleteSuggestion) {
        const { components } = suggestion;

        ctx.getField(scope, "addressLine1").setValue(components.address ?? suggestion.label);
        if (components.place !== undefined) {
            ctx.getField(scope, "city").setValue(components.place);
        }
        if (components.region?.code !== undefined) {
            ctx.getField(scope, "state").setValue(components.region.code);
        }
        if (components.postal_code !== undefined) {
            ctx.getField(scope, "postalCode").setValue(components.postal_code);
        }
        if (components.country?.code !== undefined) {
            ctx.getField(scope, "country").setValue(components.country.code);
        }

        close();
        onreveal?.();
    }

    function handleInput(e: Event) {
        const value = (e.currentTarget as HTMLInputElement).value;
        field.setState({ error: null });
        field.setValue(value);
        scheduleSearch(value);
    }

    function handleFocus() {
        field.setState({ focused: true });
    }

    function handleBlur() {
        field.setState({ focused: false });
        // Let a pointerdown selection on an option land before we close & validate.
        setTimeout(() => {
            close();
            field.validate();
            if (!field.value.trim()) return;
            onreveal?.();
        }, 150);
    }

    function handleKeydown(e: KeyboardEvent) {
        if (!open || suggestions.length === 0) return;

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                activeIndex = (activeIndex + 1) % suggestions.length;
                break;
            case "ArrowUp":
                e.preventDefault();
                activeIndex = (activeIndex - 1 + suggestions.length) % suggestions.length;
                break;
            case "Enter": {
                const active = suggestions[activeIndex];
                if (active) {
                    e.preventDefault();
                    selectSuggestion(active);
                }
                break;
            }
            case "Escape":
                e.preventDefault();
                close();
                break;
            default:
                break;
        }
    }
</script>

<FieldShell
    class="bias-addressLine1"
    {disabled}
    focused={field.state.focused}
    error={field.state.error}
>
    <input
        {id}
        data-bias-hostField
        class="bias-hostField"
        style="anchor-name:{anchorName}"
        type="text"
        autocomplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showListbox ? "true" : "false"}
        aria-controls={listboxId}
        aria-activedescendant={activeId ?? undefined}
        aria-invalid={field.state.error ? "true" : undefined}
        value={field.value}
        placeholder={placeholder ?? undefined}
        {disabled}
        oninput={handleInput}
        onfocus={handleFocus}
        onblur={handleBlur}
        onkeydown={handleKeydown}
    />
    {#if !open}
        <span
            class="🔒 bias:absolute bias:top-1/2 bias:right-[0.675rem] bias:block bias:size-3.5 bias:-translate-y-1/2 bias:pointer-events-none bias:text-(--bias-color-placeholder)"
        >
            <Icon src={MagnifyingGlass} theme="micro" class="🔒 bias:size-full" />
        </span>
    {/if}
    <div
        bind:this={panelEl}
        id="{listboxId}-panel"
        class="🔒 panel bias:mt-1 bias:-mx-1 bias:mb-0 bias:p-1 bias:border bias:border-(--bias-color-border) bias:rounded-(--bias-border-radius) bias:bg-(--bias-color-input)"
        popover="manual"
        style="position-anchor:{anchorName}"
    >
        <div class="🔒 bias:flex bias:items-center bias:justify-between bias:gap-2 bias:pt-0.5 bias:px-1.5 bias:pb-0.75">
            <span
                class="🔒 bias:text-[11px] bias:font-semibold bias:tracking-[0.06em] bias:uppercase bias:text-(--bias-color-muted-foreground)"
                >Suggestions</span
            >
            <button
                type="button"
                class="🔒 bias:inline-flex bias:items-center bias:justify-center bias:m-0 bias:p-0.5 bias:border-none bias:rounded-[calc(var(--bias-border-radius)-4px)] bias:bg-transparent bias:text-(--bias-color-muted-foreground) bias:cursor-pointer bias:font-[inherit] bias:hover:text-(--bias-color-foreground)"
                aria-label="Close suggestions"
                onmousedown={(e) => e.preventDefault()}
                onclick={close}
            >
                <Icon src={XMark} theme="mini" class="🔒 bias:size-4" />
            </button>
        </div>
        <ul
            id={listboxId}
            class="🔒 bias:list-none bias:m-0 bias:p-0 bias:overflow-auto bias:max-h-[280px]"
            role="listbox"
        >
            {#each suggestions as suggestion, index (index)}
                {@const parts = highlightMatch(suggestion.label)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <li
                    id="{listboxId}-option-{index}"
                    role="option"
                    aria-selected={index === activeIndex ? "true" : "false"}
                    class={cn(
                        "🔒 bias:flex bias:flex-col bias:gap-px bias:py-2 bias:px-(--bias-input-padding-inline) bias:rounded-[calc(var(--bias-border-radius)-4px)] bias:cursor-pointer",
                        index === activeIndex && "bias:bg-black/5",
                    )}
                    onmouseenter={() => (activeIndex = index)}
                    onmousedown={(e) => e.preventDefault()}
                    onclick={() => selectSuggestion(suggestion)}
                >
                    <span class="🔒 bias:text-(length:--bias-font-size) bias:text-(--bias-color-foreground)">
                        {#if parts}{parts.before}<strong class="🔒 bias:font-semibold"
                                >{parts.match}</strong
                            >{parts.after}{:else}{suggestion.label}{/if}
                    </span>
                    <span class="🔒 bias:text-[calc(var(--bias-font-size)*0.85)] bias:text-(--bias-color-muted-foreground)"
                        >{suggestion.secondary_label}</span
                    >
                </li>
            {/each}
        </ul>
    </div>
</FieldShell>

<style>
    .panel {
        position: fixed;
        position-area: bottom span-right;
        position-try-fallbacks: flip-block;
        width: calc(anchor-size(width) + 8px);
        box-shadow:
            var(--bias-shadow),
            0 4px 16px color-mix(in srgb, black 12%, transparent);
    }
</style>
