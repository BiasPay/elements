function toKebab(key) {
    return key.replace(/([A-Z])/g, (c) => `-${c.toLowerCase()}`);
}
export function themeVariableStyle(vars) {
    if (!vars)
        return {};
    return Object.fromEntries(Object.entries(vars)
        .filter((entry) => typeof entry[1] === "string")
        .map(([k, v]) => [`--bias-${toKebab(k)}`, v]));
}
/**
 * Applies `vars` as `--bias-*` custom properties on `element.style`, removing
 * any properties applied by a previous call that are no longer present.
 * `appliedNames` is mutated in place to track what's currently applied across calls.
 */
export function applyThemeVariables(element, vars, appliedNames) {
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
    for (const key of Object.keys(next))
        appliedNames.add(key);
}
