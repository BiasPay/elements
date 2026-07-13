import type { CheckoutSession } from "@biaspay/sdk";
import type { AddressScope, Appearance, BiasElementsError, BiasElementsState } from "~/core";
import type { BiasProviderElement } from "./provider";

export interface BiasPaymentElement extends HTMLElement {
    paymentMethodLayout?: "tabs" | "radio";
    appearance?: Appearance;
}

export interface BiasCardElement extends HTMLElement {
    appearance?: Appearance;
}

export interface BiasUSBankAccountElement extends HTMLElement {
    appearance?: Appearance;
}

export interface BiasAddressElement extends HTMLElement {
    scope?: AddressScope;
    collectPhone?: boolean;
    appearance?: Appearance;
}

export interface BiasContactElement extends HTMLElement {
    appearance?: Appearance;
}

export interface BiasSubmitButtonElement extends HTMLElement {
    disabled?: boolean;
    label?: string;
}

export type BiasChangeEvent = CustomEvent<BiasElementsState>;
export type BiasCompleteEvent = CustomEvent<BiasElementsState>;
export type BiasErrorEvent = CustomEvent<BiasElementsError>;

export type BiasProviderConfiguration = {
    clientSecret: string;
    initialCheckoutSession?: CheckoutSession;
    appearance?: Appearance;
    onComplete?: () => void;
};

declare global {
    interface HTMLElementTagNameMap {
        "bias-provider": BiasProviderElement;
        "bias-payment-element": BiasPaymentElement;
        "bias-card-element": BiasCardElement;
        "bias-us-bank-account-element": BiasUSBankAccountElement;
        "bias-address-element": BiasAddressElement;
        "bias-contact-element": BiasContactElement;
        "bias-submit-button": BiasSubmitButtonElement;
    }

    interface HTMLElementEventMap {
        biasready: CustomEvent<void>;
        biaschange: BiasChangeEvent;
        biascomplete: BiasCompleteEvent;
        biaserror: BiasErrorEvent;
    }
}
