export type Autosaver = {
    schedule(): void;
    cancel(): Promise<void>;
};
export declare function createAutosaver(onSave: (signal: AbortSignal) => Promise<unknown>, { delayMs }?: {
    delayMs?: number;
}): Autosaver;
