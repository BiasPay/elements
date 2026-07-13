import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createAutosaver } from "./autosave";

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("createAutosaver", () => {
    it("does not save before the delay elapses", () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        const autosaver = createAutosaver(onSave, { delayMs: 1000 });

        autosaver.schedule();
        vi.advanceTimersByTime(999);

        expect(onSave).not.toHaveBeenCalled();
    });

    it("saves once the delay elapses", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        const autosaver = createAutosaver(onSave, { delayMs: 1000 });

        autosaver.schedule();
        await vi.advanceTimersByTimeAsync(1000);

        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it("resets the timer on repeated schedule calls", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        const autosaver = createAutosaver(onSave, { delayMs: 1000 });

        autosaver.schedule();
        await vi.advanceTimersByTimeAsync(600);
        autosaver.schedule();
        await vi.advanceTimersByTimeAsync(600);

        expect(onSave).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(400);
        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it("cancel prevents a pending save from firing", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        const autosaver = createAutosaver(onSave, { delayMs: 1000 });

        autosaver.schedule();
        autosaver.cancel();
        await vi.advanceTimersByTimeAsync(1000);

        expect(onSave).not.toHaveBeenCalled();
    });

    it("cancel aborts an in-flight save and discards its queued follow-up", async () => {
        let signal: AbortSignal | undefined;
        const onSave = vi.fn((nextSignal: AbortSignal) => {
            signal = nextSignal;
            return new Promise<void>(() => {});
        });
        const autosaver = createAutosaver(onSave, { delayMs: 1000 });
        autosaver.schedule();
        await vi.advanceTimersByTimeAsync(1000);
        autosaver.schedule();
        autosaver.cancel();
        await vi.advanceTimersByTimeAsync(1000);

        expect(signal?.aborted).toBe(true);
        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it("queues a schedule call that arrives while a save is in flight, then runs it once", async () => {
        let resolveFirst: () => void = () => {};
        const onSave = vi
            .fn()
            .mockImplementationOnce(
                () =>
                    new Promise<void>((resolve) => {
                        resolveFirst = resolve;
                    }),
            )
            .mockResolvedValue(undefined);
        const autosaver = createAutosaver(onSave, { delayMs: 1000 });

        autosaver.schedule();
        await vi.advanceTimersByTimeAsync(1000);
        expect(onSave).toHaveBeenCalledTimes(1);

        // A schedule call while the first save is still in flight queues a
        // follow-up save rather than overlapping it.
        autosaver.schedule();
        await vi.advanceTimersByTimeAsync(1000);
        expect(onSave).toHaveBeenCalledTimes(1);

        resolveFirst();
        await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    });
});
