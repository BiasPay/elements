import { createFieldController, type FrameFieldType } from "~/core";
import type { BiasController } from "./context.svelte.ts";

export type FieldControllerHandle = {
    readonly iframeSrc: string;
    send(message: unknown): void;
    setStyle(style: string): void;
    setIframe(element: HTMLIFrameElement | undefined): void;
    handleIframeLoad(): void;
    destroy(): void;
};

export function createBiasFieldController(
    type: FrameFieldType,
    ctx: BiasController,
): FieldControllerHandle {
    const frame = ctx.core.getFrame(type);
    const controller = createFieldController({
        type,
        clientSecret: frame.clientSecret,
        frameUrl: frame.frameUrl,
        onStateChange: frame.setState,
        onEncryptedData: (field, value) => {
            if (field === type) frame.setEncryptedData(value);
        },
    });
    const unregister = ctx.core.registerFrame({
        field: type,
        triggerValidation: () => controller.send({ type: "validateFields" }),
    });
    let destroyed = false;

    return {
        get iframeSrc() {
            return controller.iframeSrc;
        },
        send: controller.send,
        setStyle: controller.setStyle,
        setIframe: controller.setIframe,
        handleIframeLoad: controller.handleIframeLoad,
        destroy() {
            if (destroyed) return;
            destroyed = true;
            unregister();
            controller.destroy();
        },
    };
}
