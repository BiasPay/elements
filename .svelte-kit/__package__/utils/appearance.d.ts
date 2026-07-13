import { type Appearance } from "../core";
export declare function mergeAppearance(inherited: Appearance | undefined, override: Appearance | undefined): Appearance | undefined;
/**
 * Svelte action that applies an `appearance`'s theme variables as `--bias-*`
 * custom properties on the node; descendant elements inherit them.
 *
 * Usage: `<div use:appearance={appearance}>`.
 */
export declare function appearance(node: HTMLElement, value: Appearance | undefined): {
    update(next: Appearance | undefined): void;
    destroy(): void;
};
