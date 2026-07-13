import type { Appearance, ElementsController } from "../core";
export declare const BIAS_PROVIDER_TAG = "bias-provider";
export type ProviderRegistration = {
    controller: ElementsController;
    getAppearance(): Appearance | undefined;
    subscribeAppearance(listener: () => void): () => void;
};
export declare function registerProvider(element: Element, registration: ProviderRegistration): void;
export declare function unregisterProvider(element: Element): void;
export declare function findProvider(element: Element): ProviderRegistration;
