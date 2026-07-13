export const BIAS_PROVIDER_TAG = "bias-provider";
const REGISTRY_KEY = Symbol.for("@biaspay/elements/provider-registry");
function registry() {
    const root = globalThis;
    const existing = root[REGISTRY_KEY];
    if (existing) {
        if (existing.version !== 1) {
            throw new Error("Bias Elements: an incompatible provider registry is already loaded.");
        }
        return existing;
    }
    const created = { version: 1, providers: new WeakMap() };
    root[REGISTRY_KEY] = created;
    return created;
}
export function registerProvider(element, registration) {
    registry().providers.set(element, registration);
}
export function unregisterProvider(element) {
    registry().providers.delete(element);
}
export function findProvider(element) {
    const provider = element.closest(BIAS_PROVIDER_TAG);
    const registration = provider && registry().providers.get(provider);
    if (!registration) {
        throw new Error("Bias Elements: elements must be descendants of <bias-provider>.");
    }
    return registration;
}
