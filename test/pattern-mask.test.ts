import { afterEach, describe, expect, it, vi } from "vitest";
import { PatternMask } from "../src/lib/utils/pattern-mask";

type MaskOptions = ConstructorParameters<typeof PatternMask>[1];

const inputs: HTMLInputElement[] = [];
const masks: PatternMask[] = [];

function setup(options: MaskOptions, initialValue = "") {
    const input = document.createElement("input");
    if (initialValue) {
        input.value = initialValue;
    }
    document.body.append(input);
    inputs.push(input);

    const mask = new PatternMask(input, options);
    masks.push(mask);

    return { input, mask };
}

function dispatchBeforeInput(
    input: HTMLInputElement,
    inputType: string,
    data: string | null,
    selectionStart: number,
    selectionEnd: number = selectionStart,
) {
    input.focus();
    input.setSelectionRange(selectionStart, selectionEnd);
    const event = new InputEvent("beforeinput", {
        inputType,
        data: data ?? undefined,
        bubbles: true,
        cancelable: true,
    });
    input.dispatchEvent(event);
}

/** Type characters one at a time via insertText, caret always at the end. */
function typeText(input: HTMLInputElement, text: string) {
    for (const char of text) {
        dispatchBeforeInput(input, "insertText", char, input.value.length);
    }
}

afterEach(() => {
    for (const mask of masks.splice(0)) {
        mask.destroy();
    }
    for (const input of inputs.splice(0)) {
        input.remove();
    }
});

describe("PatternMask value setter (static formatting)", () => {
    it("groups a full card number", () => {
        const { mask } = setup({ pattern: "0000 0000 0000 0000" });
        mask.value = "1234567890123456";
        expect(mask.value).toBe("1234 5678 9012 3456");
    });

    it("formats an expiry date", () => {
        const { mask } = setup({ pattern: "00 / 00" });
        mask.value = "1225";
        expect(mask.value).toBe("12 / 25");
    });

    it("re-derives digits from an already-formatted string", () => {
        const { mask } = setup({ pattern: "0000 0000 0000 0000" });
        mask.value = "4242 4242 4242 4242";
        expect(mask.value).toBe("4242 4242 4242 4242");
    });

    it("formats a value supplied to the constructor", () => {
        const { input } = setup({ pattern: "0000 0000 0000 0000" }, "4111111111111111");
        expect(input.value).toBe("4111 1111 1111 1111");
    });
});

describe("PatternMask optional groups", () => {
    it("uses the short variant for a 5-digit US ZIP", () => {
        const { mask } = setup({ pattern: "00000[-0000]" });
        mask.value = "12345";
        expect(mask.value).toBe("12345");
    });

    it("uses the extended variant for a 9-digit US ZIP", () => {
        const { mask } = setup({ pattern: "00000[-0000]" });
        mask.value = "123456789";
        expect(mask.value).toBe("12345-6789");
    });
});

describe("PatternMask custom definitions + prepare", () => {
    const alpha: MaskOptions = {
        pattern: "A0A 0A0",
        definitions: { A: /[A-Z]/ },
        prepare: (value) => value.toUpperCase(),
    };

    it("upper-cases and formats a CA postal code", () => {
        const { mask } = setup(alpha);
        mask.value = "k1a0b1";
        expect(mask.value).toBe("K1A 0B1");
    });

    it("formats a GB postcode through optional slots", () => {
        const { mask } = setup({
            pattern: "A[A]0[0][A] 0AA",
            definitions: { A: /[A-Z]/ },
            prepare: (value) => value.toUpperCase(),
        });
        mask.value = "sw1a1aa";
        expect(mask.value).toBe("SW1A 1AA");
    });
});

describe("PatternMask insertText", () => {
    it("formats as digits are typed", () => {
        const { input } = setup({ pattern: "0000 0000 0000 0000" });
        typeText(input, "12345");
        expect(input.value).toBe("1234 5");
        expect(input.selectionStart).toBe(6);
    });

    it("inserts in the middle and keeps the caret after the inserted char", () => {
        const { input } = setup({ pattern: "0000 0000 0000 0000" });
        typeText(input, "12345678");
        // Appending eagerly emits the next group separator at a group boundary.
        expect(input.value).toBe("1234 5678 ");

        dispatchBeforeInput(input, "insertText", "9", 2);
        expect(input.value).toBe("1293 4567 8");
        expect(input.selectionStart).toBe(3);
    });

    it("rejects a non-matching character", () => {
        const onAccept = vi.fn();
        const { input } = setup({ pattern: "0000 0000 0000 0000", onAccept });
        dispatchBeforeInput(input, "insertText", "a", 0);
        expect(input.value).toBe("");
        expect(onAccept).not.toHaveBeenCalled();
    });

    it("filters non-matching characters out of a mixed string", () => {
        const { input } = setup({ pattern: "0000 0000 0000 0000" });
        dispatchBeforeInput(input, "insertFromPaste", "12a34b5", 0);
        expect(input.value).toBe("1234 5");
    });
});

describe("PatternMask paste", () => {
    it("accepts a fully-formatted pasted value", () => {
        const { input } = setup({ pattern: "0000 0000 0000 0000" });
        dispatchBeforeInput(input, "insertFromPaste", "4242 4242 4242 4242", 0);
        expect(input.value).toBe("4242 4242 4242 4242");
    });

    it("re-derives separators from a raw pasted value", () => {
        const { input } = setup({ pattern: "0000 0000 0000 0000" });
        dispatchBeforeInput(input, "insertFromPaste", "4242-4242-4242-4242", 0);
        expect(input.value).toBe("4242 4242 4242 4242");
    });
});

describe("PatternMask deletes", () => {
    it("deleteContentBackward at a literal boundary removes the preceding digit", () => {
        const { input } = setup({ pattern: "0000 0000 0000 0000" });
        typeText(input, "12345");
        expect(input.value).toBe("1234 5");

        // Caret sits just after the space (position 5), before the trailing "5".
        dispatchBeforeInput(input, "deleteContentBackward", null, 5);
        expect(input.value).toBe("1235");
        expect(input.selectionStart).toBe(3);
    });

    it("deleteContentForward removes the character after the caret", () => {
        const { input } = setup({ pattern: "0000 0000 0000 0000" });
        typeText(input, "12345678");
        // Appending eagerly emits the next group separator at a group boundary.
        expect(input.value).toBe("1234 5678 ");

        dispatchBeforeInput(input, "deleteContentForward", null, 0);
        expect(input.value).toBe("2345 678");
        expect(input.selectionStart).toBe(0);
    });

    it("deleteSoftLineBackward deletes to the start from the caret", () => {
        const { input } = setup({ pattern: "0000 0000 0000 0000" });
        typeText(input, "12345678");
        // Appending eagerly emits the next group separator at a group boundary.
        expect(input.value).toBe("1234 5678 ");

        dispatchBeforeInput(input, "deleteSoftLineBackward", null, 6);
        expect(input.value).toBe("678");
        expect(input.selectionStart).toBe(0);
    });

    it("deleteWordBackward from the end clears the field", () => {
        const { input } = setup({ pattern: "0000 0000 0000 0000" });
        typeText(input, "12345678");
        dispatchBeforeInput(input, "deleteWordBackward", null, input.value.length);
        expect(input.value).toBe("");
    });

    it("deleteByCut removes the selected range", () => {
        const { input } = setup({ pattern: "0000 0000 0000 0000" });
        typeText(input, "12345678");
        // Appending eagerly emits the next group separator at a group boundary.
        expect(input.value).toBe("1234 5678 ");

        // Select the trailing "678" (positions 6..9) and cut it.
        dispatchBeforeInput(input, "deleteByCut", null, 6, 9);
        expect(input.value).toBe("1234 5");
    });
});

describe("PatternMask pattern setter", () => {
    it("re-formats the existing value when the pattern changes", () => {
        const { input, mask } = setup({ pattern: "0000 0000 0000 0000" });
        mask.value = "1234567890123456";
        expect(input.value).toBe("1234 5678 9012 3456");

        mask.pattern = "000000 0000 000000";
        expect(input.value).toBe("123456 7890 123456");
    });
});

describe("PatternMask onAccept", () => {
    it("fires with the current input value on an accepted edit", () => {
        const onAccept = vi.fn();
        const { input } = setup({ pattern: "0000 0000 0000 0000", onAccept });

        dispatchBeforeInput(input, "insertText", "1", 0);
        expect(input.value).toBe("1");
        expect(onAccept).toHaveBeenCalledTimes(1);
        expect(onAccept).toHaveBeenLastCalledWith("1");

        dispatchBeforeInput(input, "insertText", "2", input.value.length);
        expect(onAccept).toHaveBeenCalledTimes(2);
        expect(onAccept).toHaveBeenLastCalledWith("12");
    });
});

describe("PatternMask destroy", () => {
    it("stops reformatting after destroy", () => {
        const { input, mask } = setup({ pattern: "0000 0000 0000 0000" });

        // Sanity check: while live, typing reformats.
        typeText(input, "12345");
        expect(input.value).toBe("1234 5");

        mask.destroy();

        // After destroy the listener is gone, so a dispatched beforeinput is a no-op
        // (a programmatic beforeinput is not applied natively by the browser).
        dispatchBeforeInput(input, "insertText", "6", input.value.length);
        expect(input.value).toBe("1234 5");
    });
});
