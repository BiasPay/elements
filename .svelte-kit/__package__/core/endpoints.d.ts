import type { ElementsConfig } from "./adapter";
declare global {
    interface ImportMetaEnv {
        DEV: boolean;
        VITE_BIAS_API_URL?: string;
        VITE_BIAS_FIELD_FRAME_URL?: string;
    }
    interface ImportMeta {
        readonly env: ImportMetaEnv;
    }
}
export type ResolvedElementsConfig = ElementsConfig & {
    apiBaseUrl: string;
    frameUrl: string;
};
export declare function resolveElementsConfig(config: ElementsConfig): ResolvedElementsConfig;
