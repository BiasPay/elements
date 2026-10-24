export const FIELD_FRAME_CSS_VARS = [
    "--bias-color-input",
    "--bias-color-foreground",
    "--bias-color-placeholder",
    "--bias-font-family",
    "--bias-font-size",
    "--bias-input-padding-inline",
    "--bias-input-padding-block",
    "--bias-floating-label-factor",
] as const;

export type FieldFrameCssVariable = (typeof FIELD_FRAME_CSS_VARS)[number];
export type FieldFrameCssVariables = Record<FieldFrameCssVariable, string>;

type FieldFrameStyleOptions = {
    cssVars: FieldFrameCssVariables;
    disabled: boolean;
    floatingLabelShrunk: boolean;
    animatePadding: boolean;
};

/** Builds the private stylesheet sent to a secure field iframe. */
export function buildFieldFrameStyle({
    cssVars,
    disabled,
    floatingLabelShrunk,
    animatePadding,
}: FieldFrameStyleOptions): string {
    const declarations: string[] = [];
    const input = cssVars["--bias-color-input"];
    const foreground = cssVars["--bias-color-foreground"];
    const placeholder = cssVars["--bias-color-placeholder"];
    const fontFamily = cssVars["--bias-font-family"];
    const fontSize = cssVars["--bias-font-size"];
    const paddingInline = cssVars["--bias-input-padding-inline"];
    const paddingBlock = cssVars["--bias-input-padding-block"];
    const floatingLabelFactor = cssVars["--bias-floating-label-factor"];

    if (foreground) declarations.push(`color: ${foreground};`);
    if (fontFamily) declarations.push(`font-family: ${fontFamily};`);
    if (fontSize) declarations.push(`font-size: ${fontSize};`);
    if (paddingInline) declarations.push(`padding-inline: ${paddingInline};`);

    if (paddingBlock) {
        const paddingBlockStart =
            floatingLabelShrunk && floatingLabelFactor
                ? `calc(${paddingBlock} * (1 + ${floatingLabelFactor}))`
                : paddingBlock;
        const paddingBlockEnd =
            floatingLabelShrunk && floatingLabelFactor
                ? `calc(${paddingBlock} * (1 - ${floatingLabelFactor}))`
                : paddingBlock;
        declarations.push(`padding-block-start: ${paddingBlockStart};`);
        declarations.push(`padding-block-end: ${paddingBlockEnd};`);
    }

    declarations.push(
        animatePadding
            ? "transition: padding 200ms cubic-bezier(0, 0, 0.2, 1);"
            : "transition: none;",
    );
    if (disabled) declarations.push("opacity: 0.75;");

    const rules = [`input { ${declarations.join(" ")} }`];
    // The frame's canvas turns opaque whenever its color scheme differs from the page's, so it
    // paints the field's own background instead of relying on showing through.
    if (input) {
        const background = disabled
            ? `color-mix(in srgb, ${input}, ${foreground || "black"} 7%)`
            : input;
        rules.unshift(
            `html, body { background-color: ${background}; transition: background-color 200ms; }`,
        );
    }
    if (placeholder) {
        const placeholderAnimation = animatePadding
            ? ""
            : " animation: bias-field-placeholder-fade-in 200ms cubic-bezier(0, 0, 0.2, 1) both;";
        rules.push(
            `input::placeholder { color: ${placeholder}; opacity: 1;${placeholderAnimation} }`,
        );
        if (!animatePadding) {
            rules.push(
                "@keyframes bias-field-placeholder-fade-in { from { opacity: 0; } to { opacity: 1; } }",
            );
        }
    }
    rules.push(
        `@media (prefers-reduced-motion: reduce) { input { transition-duration: 0.01ms; }${
            !animatePadding && placeholder
                ? " input::placeholder { animation-duration: 0.01ms; }"
                : ""
        } }`,
    );
    return rules.join("\n");
}
