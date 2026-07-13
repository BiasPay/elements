export type IconTheme = Record<
    string,
    {
        a?: Record<string, string>;
        path?: Record<string, string>[];
        rect?: Record<string, string>[];
        circle?: Record<string, string>[];
        polygon?: Record<string, string>[];
        polyline?: Record<string, string>[];
        line?: Record<string, string>[];
    }
>;

export type IconSource = IconTheme;

/** Resolves the theme variant of an icon source. */
export function resolveIcon(src: IconSource | undefined, theme = "default") {
    if (!src) return undefined;
    return src[theme] ?? src["default"] ?? Object.values(src)[0];
}
