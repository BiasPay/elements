import { flushSync } from "svelte";

/**
 * Runs `read` inside a Svelte effect root and records each value it produces.
 * Rune-driven, so it must live in a `.svelte.ts` module; plain `.test.ts` files
 * import it to assert that a reactive source re-runs its dependents on change.
 * Call `flush()` after a mutation to settle effects, and `stop()` to tear down.
 */
export function trackEffect<T>(read: () => T): {
    values: T[];
    flush: () => void;
    stop: () => void;
} {
    const values: T[] = [];
    const stop = $effect.root(() => {
        $effect(() => {
            values.push(read());
        });
    });
    flushSync();
    return {
        values,
        flush: () => flushSync(),
        stop,
    };
}

/**
 * Runs `body` inside a Svelte effect that both reads and writes reactive state —
 * the shape that trips `effect_update_depth_exceeded` if reactive reads leak into
 * the change path. Returns the effect-root teardown; throws synchronously if the
 * effect loops.
 */
export function runReadWriteEffect(body: () => void): () => void {
    return $effect.root(() => {
        $effect(() => {
            body();
        });
        flushSync();
    });
}
