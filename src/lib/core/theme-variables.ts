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

function toKebab(key: string): string {
    return key.replace(/([A-Z])/g, (c) => `-${c.toLowerCase()}`);
}

export function themeVariableStyle(vars: ThemeVariables | undefined): Record<string, string> {
    if (!vars) return {};
    return Object.fromEntries(
        Object.entries(vars)
            .filter((entry): entry is [string, string] => typeof entry[1] === "string")
            .map(([k, v]) => [`--bias-${toKebab(k)}`, v]),
    );
}

/**
 * Applies `vars` as `--bias-*` custom properties on `element.style`, removing
 * any properties applied by a previous call that are no longer present.
 * `appliedNames` is mutated in place to track what's currently applied across calls.
 */
export function applyThemeVariables(
    element: HTMLElement,
    vars: ThemeVariables | undefined,
    appliedNames: Set<string>,
): void {
    const next = themeVariableStyle(vars);

    for (const key of appliedNames) {
        if (!(key in next)) {
            element.style.removeProperty(key);
        }
    }

    for (const [key, value] of Object.entries(next)) {
        element.style.setProperty(key, value);
    }

    appliedNames.clear();
    for (const key of Object.keys(next)) appliedNames.add(key);
}
