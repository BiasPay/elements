export type Autosaver = {
    schedule(generation: number): void;
    retry(generation: number): void;
    cancel(): Promise<void>;
};

export function createAutosaver(
    onSave: (signal: AbortSignal, generation: number) => Promise<unknown>,
    { delayMs = 1000 }: { delayMs?: number } = {},
): Autosaver {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let pendingGeneration: number | undefined;
    let active:
        | {
              request: AbortController;
              promise: Promise<void>;
          }
        | undefined;

    function startSave() {
        if (active || pendingGeneration === undefined) return;
        const generation = pendingGeneration;
        pendingGeneration = undefined;
        const request = new AbortController();
        const promise = runSave(request, generation);
        active = { request, promise };
    }

    async function runSave(request: AbortController, generation: number) {
        try {
            await onSave(request.signal, generation);
        } finally {
            if (active?.request === request) active = undefined;
            if (!active && pendingGeneration !== undefined && timeoutId === null) startSave();
        }
    }

    function trigger() {
        timeoutId = null;
        startSave();
    }

    function enqueue(generation: number, delay: number) {
        pendingGeneration = generation;
        if (timeoutId !== null) clearTimeout(timeoutId);
        timeoutId = setTimeout(trigger, delay);
    }

    return {
        schedule(generation) {
            enqueue(generation, delayMs);
        },
        retry(generation) {
            enqueue(generation, 0);
        },
        cancel() {
            pendingGeneration = undefined;
            active?.request.abort();
            const settling = active?.promise.catch(() => undefined) ?? Promise.resolve();
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            return settling;
        },
    };
}
