const STORAGE_PREFIX = "bias-svelte-dev:";

/** Reads a dev tweak-panel option's last persisted value, if any. */
export function readPersisted<T>(key: string, fallback: T): T {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw === null) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

/** Persists a dev tweak-panel option to `localStorage` whenever it changes. */
export function persistOnChange<T>(key: string, read: () => T): void {
    $effect(() => {
        const value = read();
        if (typeof localStorage === "undefined") return;
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    });
}
