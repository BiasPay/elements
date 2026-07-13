export type Autosaver = {
    schedule(): void;
    cancel(): Promise<void>;
};

export function createAutosaver(
    onSave: (signal: AbortSignal) => Promise<unknown>,
    { delayMs = 1000 }: { delayMs?: number } = {},
): Autosaver {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isSaving = false;
    let pendingSave = false;
    let generation = 0;
    let activeRequest: AbortController | undefined;
    let activePromise: Promise<void> | undefined;

    function startSave() {
        activePromise = runSave();
    }

    async function runSave() {
        const ownedGeneration = generation;
        isSaving = true;
        pendingSave = false;
        const request = new AbortController();
        activeRequest = request;
        try {
            await onSave(request.signal);
        } finally {
            if (activeRequest === request) activeRequest = undefined;
            if (ownedGeneration === generation) {
                isSaving = false;
                if (pendingSave) startSave();
            }
        }
    }

    function trigger() {
        timeoutId = null;
        if (isSaving) {
            pendingSave = true;
            return;
        }
        startSave();
    }

    return {
        schedule() {
            if (timeoutId !== null) clearTimeout(timeoutId);
            timeoutId = setTimeout(trigger, delayMs);
        },
        cancel() {
            generation++;
            pendingSave = false;
            isSaving = false;
            activeRequest?.abort();
            activeRequest = undefined;
            const settling = activePromise?.catch(() => undefined) ?? Promise.resolve();
            activePromise = undefined;
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            return settling;
        },
    };
}
