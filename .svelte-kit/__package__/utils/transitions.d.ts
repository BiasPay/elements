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
/**
 * Collapses a node in/out along an axis while fading (and optionally scaling /
 * translating). `t` runs 0 (collapsed) → 1 (natural) on enter and the reverse
 * on exit, matching the enter/exit keyframes of the old `animate` directive.
 */
export declare function collapse(node: Element, params?: CollapseParams): TransitionConfig;
/** Fade + scale with no size collapse (e.g. the submit-button lock icon). */
export declare function fadeScale(node: Element, params?: CollapseParams): TransitionConfig;
export declare const easeInOutSmooth: (x: number) => number;
