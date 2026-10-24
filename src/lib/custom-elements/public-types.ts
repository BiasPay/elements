import type { CheckoutSession, CheckoutSessionExpand, CountryCode } from "@biaspay/sdk";
import type {
    AddressScope,
    Appearance,
    BiasElementsError,
    BiasElementsState,
    BiasFieldValueMap,
    SavedPaymentMethod,
} from "~/core/public-types";
import type { BiasProviderElement } from "./provider";

export interface BiasPaymentElement extends HTMLElement {
    paymentMethodLayout?: "tabs" | "radio";
    savedPaymentMethodEmail?: string;
    collectBillingName?: boolean;
    collectBillingAddress?: boolean;
    appearance?: Appearance;
}

export interface BiasExpressCheckoutElement extends HTMLElement {
    disabled?: boolean;
    showSeparator?: boolean;
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
    allowedCountries?: CountryCode[];
    appearance?: Appearance;
}

export interface BiasContactElement extends HTMLElement {
    appearance?: Appearance;
    readOnly?: boolean;
    /** Defaults to `true`. */
    collectEmail?: boolean;
    collectPhone?: boolean;
}

export interface BiasDiscountCodeElement extends HTMLElement {
    appearance?: Appearance;
    onDiscountCodeChange?: (session: CheckoutSession) => void | Promise<void>;
}

export interface BiasSubmitButtonElement extends HTMLElement {
    disabled?: boolean;
    label?: string;
}

export interface BiasRememberDetailsCheckboxElement extends HTMLElement {
    checked?: boolean;
    disabled?: boolean;
    onRememberDetailsChange?: (checked: boolean) => void;
}

export type BiasChangeEvent = CustomEvent<BiasElementsState>;
export type BiasCompleteEvent = CustomEvent<BiasElementsState>;
export type BiasErrorEvent = CustomEvent<BiasElementsError>;

export type BiasProviderConfiguration = {
    clientSecret: string;
    checkoutSessionExpand?: CheckoutSessionExpand;
    defaultValues?: Partial<BiasFieldValueMap>;
    rememberDetails?: boolean;
    savedPaymentMethods?: readonly SavedPaymentMethod[];
    apiBaseUrl?: string;
    appearance?: Appearance;
    onComplete?: () => void;
};

declare global {
    interface HTMLElementTagNameMap {
        "bias-provider": BiasProviderElement;
        "bias-payment-element": BiasPaymentElement;
        "bias-express-checkout-element": BiasExpressCheckoutElement;
        "bias-card-element": BiasCardElement;
        "bias-us-bank-account-element": BiasUSBankAccountElement;
        "bias-address-element": BiasAddressElement;
        "bias-contact-element": BiasContactElement;
        "bias-discount-code-element": BiasDiscountCodeElement;
        "bias-submit-button": BiasSubmitButtonElement;
        "bias-remember-details-checkbox": BiasRememberDetailsCheckboxElement;
    }

    interface HTMLElementEventMap {
        biasready: CustomEvent<void>;
        biaschange: BiasChangeEvent;
        biascomplete: BiasCompleteEvent;
        biaserror: BiasErrorEvent;
    }
}
