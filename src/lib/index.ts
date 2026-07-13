import "./styles.css";

import { BiasProviderElement } from "./custom-elements/provider";

type LeafElementModule = {
    default: { element?: CustomElementConstructor };
};

type LeafElementDefinition = {
    tag: `bias-${string}`;
    load: () => Promise<LeafElementModule>;
};

const leafElementDefinitions = [
    { tag: "bias-payment-element", load: () => import("./custom-elements/PaymentElement.svelte") },
    { tag: "bias-card-element", load: () => import("./custom-elements/CardElement.svelte") },
    {
        tag: "bias-us-bank-account-element",
        load: () => import("./custom-elements/USBankAccountElement.svelte"),
    },
    { tag: "bias-address-element", load: () => import("./custom-elements/AddressElement.svelte") },
    { tag: "bias-contact-element", load: () => import("./custom-elements/ContactElement.svelte") },
    { tag: "bias-submit-button", load: () => import("./custom-elements/SubmitButton.svelte") },
] satisfies readonly LeafElementDefinition[];

// Svelte's generated custom-element constructors extend HTMLElement as soon as
// their modules are evaluated. Load them only in a DOM environment so the same
// package entry remains safe to import during React/Solid SSR.
const leafElementModules =
    typeof customElements === "undefined"
        ? undefined
        : await Promise.all(
              leafElementDefinitions.map(async ({ tag, load }) => ({ tag, module: await load() })),
          );

const ELEMENT_VERSION = 1;
type VersionedConstructor = CustomElementConstructor & { biasElementVersion?: number };

function defineElement(name: string, constructor: CustomElementConstructor): void {
    const existing = customElements.get(name) as VersionedConstructor | undefined;
    if (existing) {
        if (existing.biasElementVersion !== ELEMENT_VERSION) {
            throw new Error(
                `Bias Elements: <${name}> was already defined by an incompatible version.`,
            );
        }
        return;
    }
    const versioned = constructor as VersionedConstructor;
    versioned.biasElementVersion = ELEMENT_VERSION;
    customElements.define(name, versioned);
}

/** Registers every Bias custom element. Importing this package in a browser calls it automatically. */
export function defineBiasElements(): void {
    if (!leafElementModules) return;
    defineElement("bias-provider", BiasProviderElement as unknown as CustomElementConstructor);
    for (const { tag, module } of leafElementModules) {
        const constructor = module.default.element;
        if (!constructor)
            throw new Error(`Bias Elements: <${tag}> has no custom-element constructor.`);
        defineElement(tag, constructor);
    }
}

defineBiasElements();

export { BiasProviderElement } from "./custom-elements/provider";
export type { BiasFieldBinding } from "./custom-elements/provider";
export { BiasController } from "./core";
export type { ElementsController } from "./core";
export type {
    BiasAddressElement,
    BiasCardElement,
    BiasChangeEvent,
    BiasCompleteEvent,
    BiasContactElement,
    BiasErrorEvent,
    BiasPaymentElement,
    BiasProviderConfiguration,
    BiasSubmitButtonElement,
    BiasUSBankAccountElement,
} from "./custom-elements/public-types";
export type {
    AddressScope,
    Appearance,
    BiasElementsError,
    BiasElementsState,
    BiasFieldName,
    BiasFieldState,
    BiasFieldValidator,
    BiasFieldValueMap,
    PaymentMethod,
    SessionState,
    SubmissionStatus,
    ThemeVariables,
} from "./core";
