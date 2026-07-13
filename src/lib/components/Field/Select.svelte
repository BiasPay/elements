<script lang="ts">
    import type { FullAutoFill } from "svelte/elements";
    import { ChevronDown } from "@steeze-ui/heroicons";
    import { cn } from "~/utils/classes";
    import Icon from "../Icon/Icon.svelte";
    import FieldShell from "./FieldShell.svelte";

    type Option = { value: string; label: string };

    type Props = {
        value: string;
        options: Option[];
        class: string;
        id?: string;
        disabled?: boolean;
        error?: boolean;
        autocomplete?: FullAutoFill;
        /** A non-selectable prompt shown while no value is chosen. */
        placeholder?: string;
        onchange: (value: string) => void;
    };

    let {
        value,
        options,
        class: className,
        id,
        disabled,
        error,
        autocomplete,
        placeholder,
        onchange,
    }: Props = $props();
</script>

<FieldShell class={cn(className, "bias-selectRoot 🔒 bias:grid bias:items-center")} {disabled} {error}>
    <select
        {id}
        data-bias-hostField
        class="bias-hostField bias-select 🔒 bias:col-start-1 bias:row-start-1 bias:cursor-pointer"
        {disabled}
        {autocomplete}
        aria-invalid={error ? "true" : undefined}
        onchange={(e) => onchange((e.currentTarget as HTMLSelectElement).value)}
    >
        {#if placeholder !== undefined}
            <option value="" selected={!value} disabled hidden>{placeholder}</option>
        {/if}
        {#each options as option (option.value)}
            <option value={option.value} selected={option.value === value}>{option.label}</option>
        {/each}
    </select>
    <span class="bias-selectChevron 🔒 bias:col-start-1 bias:row-start-1 bias:justify-self-end bias:self-center bias:mr-[0.675rem]">
        <Icon
            class="bias-hostFieldAffordance 🔒 bias:block bias:size-4.5 bias:shrink-0 bias:pointer-events-none bias:text-(--bias-color-placeholder)"
            src={ChevronDown}
            theme="mini"
        />
    </span>
</FieldShell>
