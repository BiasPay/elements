import type { BiasFieldStatus, FrameFieldType } from "./types";
export type FieldControllerOptions = {
    type: FrameFieldType;
    clientSecret: string;
    frameUrl: string;
    onStateChange(nextState: Partial<BiasFieldStatus>): void;
    onEncryptedData?(field: FrameFieldType, encryptedValue: string | null): void;
};
export type FieldController = {
    readonly iframeSrc: string;
    setIframe(element: HTMLIFrameElement | undefined): void;
    send(message: unknown): void;
    setStyle(css: string): void;
    handleIframeLoad(): void;
    destroy(): void;
};
export declare function createFieldController(options: FieldControllerOptions): FieldController;
