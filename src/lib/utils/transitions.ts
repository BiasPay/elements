import bezier from "bezier-easing";
import { cubicOut } from "svelte/easing";
import type { TransitionConfig } from "svelte/transition";

/**
 * Enter/exit transitions for `{#if}`-guarded elements: grow a node in from a
 * collapsed keyframe (and shrink it back out) as it enters or leaves the tree,
 * optionally fading, scaling, and translating along the way.
 */

export type CollapseParams = {
    delay?: number;
    duration?: number;
    easing?: (t: number) => number;
    /** Axis to collapse along. "none" only fades/scales (no size change). */
    axis?: "x" | "y" | "none";
    /** Opacity at the collapsed end (default 0, i.e. fully faded). */
    opacity?: number;
    /** Scale at the collapsed end (default 1, i.e. no scaling). */
    scale?: number;
    /** `translate` value at the collapsed end, e.g. "0 -2px". */
    translate?: string;
};

/** Scales every numeric part of a `translate` value by `factor` (px-safe). */
function scaleTranslate(value: string, factor: number): string {
    return value
        .trim()
        .split(/\s+/)
        .map((part) => {
            const match = /^(-?[\d.]+)(.*)$/.exec(part);
            if (!match) return part;
            return `${parseFloat(match[1]) * factor}${match[2] || ""}`;
        })
        .join(" ");
}

/**
 * Collapses a node in/out along an axis while fading (and optionally scaling /
 * translating). `t` runs 0 (collapsed) → 1 (natural) on enter and the reverse
 * on exit, matching the enter/exit keyframes of the old `animate` directive.
 */
export function collapse(node: Element, params: CollapseParams = {}): TransitionConfig {
    const {
        delay = 0,
        duration = 300,
        easing = cubicOut,
        axis = "y",
        opacity = 0,
        scale = 1,
        translate,
    } = params;

    const style = getComputedStyle(node);
    const targetOpacity = Number(style.opacity) || 1;
    const deltaOpacity = targetOpacity - opacity;

    const isX = axis === "x";
    const size = parseFloat(isX ? style.width : style.height) || 0;
    const padStart = parseFloat(isX ? style.paddingLeft : style.paddingTop) || 0;
    const padEnd = parseFloat(isX ? style.paddingRight : style.paddingBottom) || 0;
    const marginStart = parseFloat(isX ? style.marginLeft : style.marginTop) || 0;
    const marginEnd = parseFloat(isX ? style.marginRight : style.marginBottom) || 0;
    const borderStart = parseFloat(isX ? style.borderLeftWidth : style.borderTopWidth) || 0;
    const borderEnd = parseFloat(isX ? style.borderRightWidth : style.borderBottomWidth) || 0;

    const dim = isX ? "width" : "height";
    const s = isX ? "left" : "top";
    const e = isX ? "right" : "bottom";

    return {
        delay,
        duration,
        easing,
        css: (t, u) => {
            let css = `opacity: ${opacity + deltaOpacity * t};`;
            if (axis !== "none") {
                css +=
                    `${dim}: ${t * size}px;` +
                    `padding-${s}: ${t * padStart}px; padding-${e}: ${t * padEnd}px;` +
                    `margin-${s}: ${t * marginStart}px; margin-${e}: ${t * marginEnd}px;` +
                    `border-${s}-width: ${t * borderStart}px; border-${e}-width: ${t * borderEnd}px;`;
            }
            if (scale !== 1) css += `scale: ${scale + (1 - scale) * t};`;
            if (translate) css += `translate: ${scaleTranslate(translate, u)};`;
            return css;
        },
    };
}

/** Fade + scale with no size collapse (e.g. the submit-button lock icon). */
export function fadeScale(node: Element, params: CollapseParams = {}): TransitionConfig {
    return collapse(node, { axis: "none", scale: 0.85, duration: 200, ...params });
}

export const easeInOutSmooth = bezier(0.32, 0.72, 0, 1);
