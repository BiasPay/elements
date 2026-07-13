import type { CheckoutSession } from "@biaspay/sdk";
import type { AddressMetadata } from "./address-metadata";
import type { ThemeVariables } from "./theme-variables";

export type PaymentMethod = "card" | "us_bank_account";
export type AddressScope = "billing" | "shipping";
export type SubmissionStatus = "idle" | "submitting" | "succeeded" | "failed";

export type BiasElementsErrorCode =
    | "authentication_failed"
    | "session_load_failed"
    | "session_update_failed"
    | "payment_failed"
    | "frame_failed"
    | "configuration_error";

export interface BiasElementsError extends Error {
    readonly code: BiasElementsErrorCode;
    readonly retryable: boolean;
}

export type SessionState =
    | { readonly status: "idle" }
    | { readonly status: "loading" }
    | { readonly status: "ready"; readonly session: CheckoutSession }
    | { readonly status: "refreshing"; readonly session: CheckoutSession }
    | {
          readonly status: "error";
          readonly error: BiasElementsError;
          readonly session?: CheckoutSession;
      };

export type Appearance = {
    variables?: ThemeVariables;
    labelStyle?: "static" | "floating" | "placeholder";
};

export type BiasFieldName =
    | "country"
    | "postalCode"
    | "accountType"
    | "email"
    | "name"
    | "addressLine1"
    | "addressLine2"
    | "city"
    | "state"
    | "phone"
    | "shippingCountry"
    | "shippingPostalCode"
    | "shippingName"
    | "shippingAddressLine1"
    | "shippingAddressLine2"
    | "shippingCity"
    | "shippingState"
    | "shippingPhone";

export type BiasFieldValueMap = {
    country: string;
    postalCode: string;
    accountType: "checking" | "savings";
    email: string;
    name: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    phone: string;
    shippingCountry: string;
    shippingPostalCode: string;
    shippingName: string;
    shippingAddressLine1: string;
    shippingAddressLine2: string;
    shippingCity: string;
    shippingState: string;
    shippingPhone: string;
};

export type BiasFieldState<T> = {
    value: T;
    isFocused: boolean;
    isValid: boolean;
    error: string | null;
};

export type BiasFieldValidator<K extends BiasFieldName> = (value: BiasFieldValueMap[K]) => {
    isValid: boolean;
    error: string | null;
};

export type AddressMetadataState =
    | { status: "loading"; metadata: AddressMetadata }
    | { status: "ready"; metadata: AddressMetadata }
    | { status: "fallback"; metadata: AddressMetadata };

export type BiasElementsState = {
    sessionState: SessionState;
    paymentMethod: PaymentMethod | undefined;
    status: SubmissionStatus;
    canSubmit: boolean;
    submissionError: BiasElementsError | null;
};
