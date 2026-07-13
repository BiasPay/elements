import type { Appearance, ElementsController } from "~/core";

export const BIAS_PROVIDER_TAG = "bias-provider";

export type ProviderRegistration = {
    controller: ElementsController;
    getAppearance(): Appearance | undefined;
    subscribeAppearance(listener: () => void): () => void;
};

type BiasRegistry = {
    version: 1;
    providers: WeakMap<Element, ProviderRegistration>;
};

const REGISTRY_KEY = Symbol.for("@biaspay/elements/provider-registry");

function registry(): BiasRegistry {
    const root = globalThis as typeof globalThis & { [REGISTRY_KEY]?: BiasRegistry };
    const existing = root[REGISTRY_KEY];
    if (existing) {
        if (existing.version !== 1) {
            throw new Error("Bias Elements: an incompatible provider registry is already loaded.");
        }
        return existing;
    }
    const created: BiasRegistry = { version: 1, providers: new WeakMap() };
    root[REGISTRY_KEY] = created;
    return created;
}

export function registerProvider(element: Element, registration: ProviderRegistration): void {
    registry().providers.set(element, registration);
}

export function unregisterProvider(element: Element): void {
    registry().providers.delete(element);
}

export function findProvider(element: Element): ProviderRegistration {
    const provider = element.closest(BIAS_PROVIDER_TAG);
    const registration = provider && registry().providers.get(provider);
    if (!registration) {
        throw new Error("Bias Elements: elements must be descendants of <bias-provider>.");
    }
    return registration;
}
