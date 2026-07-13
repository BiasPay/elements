import { BiasController } from "../context.svelte";
import { setAppearanceContext, setBiasContext } from "../context.svelte";
import { createSubscriber } from "svelte/reactivity";
import { findProvider } from "./registry";
export function setupCustomElement(host) {
    const provider = findProvider(host);
    setBiasContext(BiasController.fromCore(provider.controller));
    const trackAppearance = createSubscriber(provider.subscribeAppearance);
    setAppearanceContext(() => {
        trackAppearance();
        return provider.getAppearance();
    });
}
