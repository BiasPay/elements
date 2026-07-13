export type ThemeVariables = {
    colorPrimary?: string | null;
    colorBackground?: string | null;
    colorInput?: string | null;
    colorForeground?: string | null;
    colorMutedForeground?: string | null;
    colorPlaceholder?: string | null;
    colorBorder?: string | null;
    colorSuccess?: string | null;
    colorError?: string | null;
    focusRing?: string | null;
    shadow?: string | null;
    borderRadius?: string | null;
    fontFamily?: string | null;
    fontSize?: string | null;
    gap?: string | null;
};
export declare function themeVariableStyle(vars: ThemeVariables | undefined): Record<string, string>;
/**
 * Applies `vars` as `--bias-*` custom properties on `element.style`, removing
 * any properties applied by a previous call that are no longer present.
 * `appliedNames` is mutated in place to track what's currently applied across calls.
 */
export declare function applyThemeVariables(element: HTMLElement, vars: ThemeVariables | undefined, appliedNames: Set<string>): void;
