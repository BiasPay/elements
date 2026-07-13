type PatternMaskDefinitions = Record<string, RegExp>;
type PatternMaskOptions = {
    pattern: string;
    definitions?: PatternMaskDefinitions;
    prepare?: (value: string) => string;
    onAccept?: (value: string) => void;
};
export declare class PatternMask {
    #private;
    constructor(input: HTMLInputElement, options: PatternMaskOptions);
    destroy(): void;
    get pattern(): string;
    set pattern(nextPattern: string);
    get value(): string;
    set value(nextValue: string);
}
export {};
