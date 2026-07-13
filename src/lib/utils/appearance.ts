import { applyThemeVariables, type Appearance } from "~/core";

export function mergeAppearance(
    inherited: Appearance | undefined,
    override: Appearance | undefined,
): Appearance | undefined {
    if (!inherited && !override) return undefined;
    return {
        ...inherited,
        ...override,
        variables:
            inherited?.variables || override?.variables
                ? { ...inherited?.variables, ...override?.variables }
                : undefined,
    };
}

/**
 * Svelte action that applies an `appearance`'s theme variables as `--bias-*`
 * custom properties on the node; descendant elements inherit them.
 *
 * Usage: `<div use:appearance={appearance}>`.
 */
export function appearance(node: HTMLElement, value: Appearance | undefined) {
    const applied = new Set<string>();
    applyThemeVariables(node, value?.variables, applied);

    return {
        update(next: Appearance | undefined) {
            applyThemeVariables(node, next?.variables, applied);
        },
        destroy() {
            applyThemeVariables(node, undefined, applied);
        },
    };
}
