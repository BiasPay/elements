const DEFAULT_DEFINITIONS = {
    0: /\d/,
    A: /[A-Za-z]/,
};
function parsePattern(pattern) {
    let index = 0;
    const parseSegments = (terminator) => {
        const segments = [];
        while (index < pattern.length) {
            const char = pattern[index];
            if (terminator && char === terminator) {
                index += 1;
                return segments;
            }
            if (char === "[") {
                index += 1;
                segments.push({ type: "optional", children: parseSegments("]") });
                continue;
            }
            if (char === "]") {
                throw new Error(`Unexpected ] in pattern "${pattern}"`);
            }
            segments.push(DEFAULT_DEFINITIONS[char]
                ? { type: "slot", key: char }
                : { type: "literal", value: char });
            index += 1;
        }
        if (terminator) {
            throw new Error(`Unclosed optional group in pattern "${pattern}"`);
        }
        return segments;
    };
    return parseSegments();
}
function compileVariants(pattern, definitions) {
    const segments = parsePattern(pattern);
    const expand = (nodes) => {
        let variants = [[]];
        for (const node of nodes) {
            if (node.type === "literal") {
                variants = variants.map((items) => [
                    ...items,
                    { type: "literal", value: node.value },
                ]);
                continue;
            }
            if (node.type === "slot") {
                const matcher = definitions[node.key];
                if (!matcher) {
                    throw new Error(`Missing definition for slot "${node.key}" in pattern "${pattern}"`);
                }
                variants = variants.map((items) => [
                    ...items,
                    { type: "slot", key: node.key, matcher },
                ]);
                continue;
            }
            const childVariants = expand(node.children);
            const next = [];
            for (const items of variants) {
                next.push(items);
                for (const child of childVariants) {
                    next.push([...items, ...child]);
                }
            }
            variants = next;
        }
        return variants;
    };
    return expand(segments)
        .map((items) => ({
        items,
        slotCount: items.filter((item) => item.type === "slot").length,
    }))
        .sort((a, b) => a.slotCount - b.slotCount || a.items.length - b.items.length);
}
function normalizeText(text, prepare) {
    return prepare ? prepare(text) : text;
}
function packWithVariant(variant, parts, prepare) {
    const acceptedCounts = [];
    let slotIndex = 0;
    let raw = "";
    for (const part of parts) {
        for (const char of normalizeText(part.text, prepare)) {
            while (slotIndex < variant.items.length &&
                variant.items[slotIndex]?.type === "literal") {
                slotIndex += 1;
            }
            if (slotIndex >= variant.items.length) {
                continue;
            }
            const item = variant.items[slotIndex];
            if (item.type === "slot" && item.matcher.test(char)) {
                raw += char;
                slotIndex += 1;
            }
        }
        acceptedCounts.push(raw.length);
    }
    return { raw, acceptedCounts, variant };
}
function bestPack(variants, parts, prepare) {
    let best = null;
    for (const variant of variants) {
        const candidate = packWithVariant(variant, parts, prepare);
        if (!best || candidate.raw.length > best.raw.length) {
            best = candidate;
        }
    }
    return best;
}
function formatWithVariant(variant, raw, appending) {
    const boundaries = Array.from({ length: raw.length + 1 }, () => 0);
    const totalSlots = variant.slotCount;
    let value = "";
    let rawIndex = 0;
    for (const item of variant.items) {
        if (item.type === "slot") {
            if (rawIndex >= raw.length) {
                break;
            }
            value += raw[rawIndex];
            rawIndex += 1;
            boundaries[rawIndex] = value.length;
            continue;
        }
        if (raw.length === 0) {
            break;
        }
        const threshold = appending ? raw.length : raw.length - 1;
        const shouldInclude = (rawIndex <= threshold && rawIndex < totalSlots) || rawIndex === totalSlots;
        if (!shouldInclude) {
            break;
        }
        value += item.value;
        boundaries[rawIndex] = value.length;
    }
    return { value, boundaries };
}
function rawIndexFromPosition(boundaries, position) {
    for (let index = 0; index < boundaries.length; index += 1) {
        if (boundaries[index] >= position) {
            return index;
        }
    }
    return boundaries.length - 1;
}
export class PatternMask {
    #input;
    #abortController = new AbortController();
    #definitions;
    #prepare;
    #onAccept;
    #pattern;
    #variants;
    #dispatchingSyntheticInput = false;
    constructor(input, options) {
        this.#input = input;
        this.#definitions = { ...DEFAULT_DEFINITIONS, ...options.definitions };
        this.#prepare = options.prepare;
        this.#onAccept = options.onAccept;
        this.#pattern = options.pattern;
        this.#variants = compileVariants(options.pattern, this.#definitions);
        const opts = { signal: this.#abortController.signal };
        input.addEventListener("beforeinput", this.#onBeforeInput, opts);
        input.addEventListener("input", this.#onInput, opts);
        if (input.value) {
            this.value = input.value;
        }
    }
    destroy() {
        this.#abortController.abort();
    }
    get pattern() {
        return this.#pattern;
    }
    set pattern(nextPattern) {
        if (nextPattern === this.#pattern) {
            return;
        }
        const currentValue = this.#input.value;
        this.#pattern = nextPattern;
        this.#variants = compileVariants(nextPattern, this.#definitions);
        this.value = currentValue;
    }
    get value() {
        return this.#input.value;
    }
    set value(nextValue) {
        const packed = bestPack(this.#variants, [{ text: nextValue }], this.#prepare);
        if (!packed) {
            this.#input.value = "";
            return;
        }
        const formatted = formatWithVariant(packed.variant, packed.raw, true);
        this.#input.value = formatted.value;
    }
    #emitAccept(value) {
        this.#onAccept?.(value);
    }
    #packCurrentValue() {
        return bestPack(this.#variants, [{ text: this.#input.value }], this.#prepare);
    }
    #applyRaw(raw, rawCursor, appending) {
        const previousValue = this.#input.value;
        const packed = bestPack(this.#variants, [{ text: raw }], this.#prepare);
        if (!packed) {
            return false;
        }
        const formatted = formatWithVariant(packed.variant, packed.raw, appending);
        const clampedCursor = Math.min(rawCursor, formatted.boundaries.length - 1);
        if (formatted.value === previousValue) {
            this.#input.setSelectionRange(formatted.boundaries[clampedCursor], formatted.boundaries[clampedCursor]);
            return false;
        }
        this.#input.value = formatted.value;
        this.#input.setSelectionRange(formatted.boundaries[clampedCursor], formatted.boundaries[clampedCursor]);
        return true;
    }
    #dispatchSyntheticInput(inputType, data) {
        this.#dispatchingSyntheticInput = true;
        this.#input.dispatchEvent(new InputEvent("input", {
            bubbles: true,
            inputType,
            data: data ?? undefined,
        }));
        this.#dispatchingSyntheticInput = false;
    }
    #deleteBackward(selectionStart, selectionEnd) {
        const packed = this.#packCurrentValue();
        if (!packed) {
            return false;
        }
        let before = rawIndexFromPosition(formatWithVariant(packed.variant, packed.raw, true).boundaries, selectionStart);
        const after = rawIndexFromPosition(formatWithVariant(packed.variant, packed.raw, true).boundaries, selectionEnd);
        if (selectionStart === selectionEnd) {
            if (before === 0) {
                return false;
            }
            before -= 1;
        }
        return this.#applyRaw(packed.raw.slice(0, before) + packed.raw.slice(after), before, false);
    }
    #deleteForward(selectionStart, selectionEnd) {
        const packed = this.#packCurrentValue();
        if (!packed) {
            return false;
        }
        const boundaries = formatWithVariant(packed.variant, packed.raw, true).boundaries;
        const before = rawIndexFromPosition(boundaries, selectionStart);
        let after = rawIndexFromPosition(boundaries, selectionEnd);
        if (selectionStart === selectionEnd) {
            if (after >= packed.raw.length) {
                return false;
            }
            after += 1;
        }
        return this.#applyRaw(packed.raw.slice(0, before) + packed.raw.slice(after), before, false);
    }
    #deleteToBoundary(selectionStart, selectionEnd, direction) {
        const packed = this.#packCurrentValue();
        if (!packed) {
            return false;
        }
        const boundaries = formatWithVariant(packed.variant, packed.raw, true).boundaries;
        const before = rawIndexFromPosition(boundaries, selectionStart);
        const after = rawIndexFromPosition(boundaries, selectionEnd);
        if (direction === "backward") {
            return this.#applyRaw(packed.raw.slice(after), 0, false);
        }
        return this.#applyRaw(packed.raw.slice(0, before), before, false);
    }
    #replaceSelection(selectionStart, selectionEnd, insertedText) {
        const packed = this.#packCurrentValue();
        if (!packed) {
            return false;
        }
        const boundaries = formatWithVariant(packed.variant, packed.raw, true).boundaries;
        const before = rawIndexFromPosition(boundaries, selectionStart);
        const after = rawIndexFromPosition(boundaries, selectionEnd);
        const next = bestPack(this.#variants, [
            { text: packed.raw.slice(0, before) },
            { text: insertedText },
            { text: packed.raw.slice(after) },
        ], this.#prepare);
        if (!next) {
            return false;
        }
        const rawCursor = next.acceptedCounts[1] ?? before;
        return this.#applyRaw(next.raw, rawCursor, true);
    }
    #onBeforeInput = (event) => {
        if (event.inputType === "historyUndo" || event.inputType === "historyRedo") {
            return;
        }
        const selectionStart = this.#input.selectionStart ?? 0;
        const selectionEnd = this.#input.selectionEnd ?? selectionStart;
        let changed = false;
        switch (event.inputType) {
            case "insertText":
            case "insertFromPaste":
            case "insertFromDrop": {
                const insertedText = event.data ?? event.dataTransfer?.getData("text") ?? "";
                changed = this.#replaceSelection(selectionStart, selectionEnd, insertedText);
                break;
            }
            case "deleteContentBackward":
                changed = this.#deleteBackward(selectionStart, selectionEnd);
                break;
            case "deleteContentForward":
                changed = this.#deleteForward(selectionStart, selectionEnd);
                break;
            case "deleteWordBackward":
            case "deleteSoftLineBackward":
            case "deleteHardLineBackward":
                changed = this.#deleteToBoundary(selectionStart, selectionEnd, "backward");
                break;
            case "deleteWordForward":
            case "deleteSoftLineForward":
            case "deleteHardLineForward":
                changed = this.#deleteToBoundary(selectionStart, selectionEnd, "forward");
                break;
            case "deleteByCut":
                changed = this.#replaceSelection(selectionStart, selectionEnd, "");
                break;
            default:
                return;
        }
        if (!changed) {
            event.preventDefault();
            return;
        }
        event.preventDefault();
        this.#emitAccept(this.#input.value);
        this.#dispatchSyntheticInput(event.inputType, event.data ?? null);
    };
    #onInput = (event) => {
        if (this.#dispatchingSyntheticInput) {
            return;
        }
        const selectionStart = this.#input.selectionStart ?? this.#input.value.length;
        const packed = bestPack(this.#variants, [
            { text: this.#input.value.slice(0, selectionStart) },
            { text: this.#input.value.slice(selectionStart) },
        ], this.#prepare);
        if (!packed) {
            return;
        }
        const formatted = formatWithVariant(packed.variant, packed.raw, !event.inputType?.startsWith("delete"));
        const rawCursor = packed.acceptedCounts[0] ?? 0;
        if (this.#input.value !== formatted.value) {
            this.#input.value = formatted.value;
        }
        this.#input.setSelectionRange(formatted.boundaries[rawCursor], formatted.boundaries[rawCursor]);
        this.#emitAccept(this.#input.value);
    };
}
