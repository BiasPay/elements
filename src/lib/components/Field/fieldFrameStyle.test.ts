import { describe, expect, it } from "vitest";
import { buildFieldFrameStyle, type FieldFrameCssVariables } from "./fieldFrameStyle";

const DEFAULT_VARS: FieldFrameCssVariables = {
    "--bias-color-input": "#ffffff",
    "--bias-color-foreground": "rgb(20 30 40)",
    "--bias-color-placeholder": "rgba(20 30 40 / 0.5)",
    "--bias-font-family": "Inter, sans-serif",
    "--bias-font-size": "16px",
    "--bias-input-padding-inline": "0.65rem",
    "--bias-input-padding-block": "0.6875rem",
    "--bias-floating-label-factor": "0.675",
};

describe("buildFieldFrameStyle", () => {
    it("uses equal block padding when the floating label is not shrunk", () => {
        const style = buildFieldFrameStyle({
            cssVars: DEFAULT_VARS,
            disabled: false,
            floatingLabelShrunk: false,
            animatePadding: true,
        });

        expect(style).toContain("padding-block-start: 0.6875rem;");
        expect(style).toContain("padding-block-end: 0.6875rem;");
    });

    it("uses asymmetric block padding when the floating label is shrunk", () => {
        const style = buildFieldFrameStyle({
            cssVars: DEFAULT_VARS,
            disabled: false,
            floatingLabelShrunk: true,
            animatePadding: true,
        });

        expect(style).toContain("padding-block-start: calc(0.6875rem * (1 + 0.675));");
        expect(style).toContain("padding-block-end: calc(0.6875rem * (1 - 0.675));");
    });

    it("keeps custom CSS-variable values authoritative", () => {
        const style = buildFieldFrameStyle({
            cssVars: {
                ...DEFAULT_VARS,
                "--bias-input-padding-inline": "clamp(8px, 2vw, 20px)",
                "--bias-input-padding-block": "calc(0.5rem + 2px)",
                "--bias-floating-label-factor": "0.4",
            },
            disabled: false,
            floatingLabelShrunk: true,
            animatePadding: true,
        });

        expect(style).toContain("padding-inline: clamp(8px, 2vw, 20px);");
        expect(style).toContain("input::placeholder { color: rgba(20 30 40 / 0.5); opacity: 1; }");
        expect(style).toContain("padding-block-start: calc(calc(0.5rem + 2px) * (1 + 0.4));");
        expect(style).toContain("padding-block-end: calc(calc(0.5rem + 2px) * (1 - 0.4));");
    });

    it("includes disabled opacity only for disabled fields", () => {
        const enabled = buildFieldFrameStyle({
            cssVars: DEFAULT_VARS,
            disabled: false,
            floatingLabelShrunk: false,
            animatePadding: true,
        });
        const disabled = buildFieldFrameStyle({
            cssVars: DEFAULT_VARS,
            disabled: true,
            floatingLabelShrunk: false,
            animatePadding: true,
        });

        expect(enabled).not.toContain("opacity: 0.75;");
        expect(disabled).toContain("opacity: 0.75;");
    });

    it("paints the field background, tinted like the frame when disabled", () => {
        const enabled = buildFieldFrameStyle({
            cssVars: DEFAULT_VARS,
            disabled: false,
            floatingLabelShrunk: false,
            animatePadding: true,
        });
        const disabled = buildFieldFrameStyle({
            cssVars: DEFAULT_VARS,
            disabled: true,
            floatingLabelShrunk: false,
            animatePadding: true,
        });

        expect(enabled).toContain("html, body { background-color: #ffffff;");
        expect(disabled).toContain(
            "html, body { background-color: color-mix(in srgb, #ffffff, rgb(20 30 40) 7%);",
        );
    });

    it("animates padding and shortens the transition for reduced motion", () => {
        const style = buildFieldFrameStyle({
            cssVars: DEFAULT_VARS,
            disabled: false,
            floatingLabelShrunk: false,
            animatePadding: true,
        });

        expect(style).toMatch(/transition:\s*padding\b/);
        expect(style).not.toContain("@keyframes");
        expect(style).toContain("@media (prefers-reduced-motion: reduce)");
        expect(style).toMatch(/transition-duration:/);
    });

    it("does not animate initial padding and fades in the initial placeholder", () => {
        const style = buildFieldFrameStyle({
            cssVars: DEFAULT_VARS,
            disabled: false,
            floatingLabelShrunk: false,
            animatePadding: false,
        });

        expect(style).not.toMatch(/transition:\s*padding\b/);
        expect(style).toMatch(/input::placeholder\s*\{[^}]*animation:/);
        expect(style).toContain("@keyframes");
        expect(style).toMatch(/animation-duration:/);
    });
});
