import { type FrameFieldType } from "./core";
import type { BiasController } from "./context.svelte.ts";
export type FieldControllerHandle = {
    readonly iframeSrc: string;
    send(message: unknown): void;
    setStyle(style: string): void;
    setIframe(element: HTMLIFrameElement | undefined): void;
    handleIframeLoad(): void;
    destroy(): void;
};
export declare function createBiasFieldController(type: FrameFieldType, ctx: BiasController): FieldControllerHandle;
