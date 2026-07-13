import { applyThemeVariables } from "../core";
export function mergeAppearance(inherited, override) {
    if (!inherited && !override)
        return undefined;
    return {
        ...inherited,
        ...override,
        variables: inherited?.variables || override?.variables
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
export function appearance(node, value) {
    const applied = new Set();
    applyThemeVariables(node, value?.variables, applied);
    return {
        update(next) {
            applyThemeVariables(node, next?.variables, applied);
        },
        destroy() {
            applyThemeVariables(node, undefined, applied);
        },
    };
}
