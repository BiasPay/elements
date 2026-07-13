/** Resolves the theme variant of an icon source. */
export function resolveIcon(src, theme = "default") {
    if (!src)
        return undefined;
    return src[theme] ?? src["default"] ?? Object.values(src)[0];
}
