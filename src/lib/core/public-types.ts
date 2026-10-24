import type {
    Card,
    CheckoutSession,
    CheckoutSessionExpand,
    CheckoutSessionUpdateParams,
    CountryCode,
    PaymentMethod as ApiPaymentMethod,
    UsBankAccount,
} from "@biaspay/sdk";
import type { AddressMetadata } from "./address-metadata";
import type { ThemeVariables } from "./theme-variables";

export type ConventionalPaymentMethod = "card" | "us_bank_account";
export type WalletPaymentMethod = "apple_pay";
export type SessionPaymentMethod = ConventionalPaymentMethod | WalletPaymentMethod;
/** Backwards-compatible name for methods collected by conventional Elements forms. */
export type PaymentMethod = ConventionalPaymentMethod;
export type WalletAvailabilityStatus = "loading" | "available" | "unavailable";
export type WalletAvailability = {
    readonly applePay: WalletAvailabilityStatus;
};
/** The parts of a saved payment method Elements shows and pays with. */
export type SavedPaymentMethod = Pick<
    ApiPaymentMethod,
    "object" | "id" | "live" | "created_at" | "active" | "type"
> & {
    billing_details: { name: string | null };
    card: Pick<Card, "brand" | "last4" | "exp_month" | "exp_year"> | null;
    us_bank_account: Pick<UsBankAccount, "bank_name" | "last4" | "account_type"> | null;
};
export type AddressScope = "billing" | "shipping";
/**
 * `processing`: the payment was submitted but its outcome is still unknown (for
 * example a card payment in review). Submission stays locked and Elements keeps
 * checking; it moves to `succeeded` or `failed` once the outcome is final.
 */
export type SubmissionStatus =
    | "idle"
    | "presenting_wallet"
    | "submitting"
    | "processing"
    | "succeeded"
    | "failed";
export type DiscountCodeAction = "apply" | "remove";

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
    /** The Bias API error type when the failure came from an API response, such as `server_error`. */
    readonly apiErrorType?: string;
    /** The API's `customer_message` when the failure came from an API response that wrote one. Safe to show a customer as is. */
    readonly customerMessage?: string;
}

export type DetailsSaveState =
    | { readonly status: "idle" | "dirty" | "saving" | "saved" }
    | { readonly status: "error"; readonly error: BiasElementsError };

export type SessionState<Session = CheckoutSession> =
    | { readonly status: "idle" }
    | { readonly status: "loading" }
    | { readonly status: "ready"; readonly session: Session }
    | { readonly status: "refreshing"; readonly session: Session }
    | {
          readonly status: "error";
          readonly error: BiasElementsError;
          readonly session?: Session;
      };

export type DiscountCodeState = {
    readonly pendingAction: DiscountCodeAction | null;
    readonly error: string | null;
    readonly blocked: boolean;
    readonly blocksSubmission: boolean;
    readonly optimisticallyRemovedDiscountIds: readonly string[];
};

export type Appearance = {
    variables?: ThemeVariables;
    labelStyle?: "static" | "floating" | "placeholder";
};

export type AddressElementOptions = {
    allowedCountries?: CountryCode[];
};

export type BiasFieldName =
    | "country"
    | "postalCode"
    | "accountType"
    | "accountHolderType"
    | "email"
    | "phone"
    | "name"
    | "firstName"
    | "lastName"
    | "addressLine1"
    | "addressLine2"
    | "city"
    | "state"
    | "shippingCountry"
    | "shippingPostalCode"
    | "shippingFirstName"
    | "shippingLastName"
    | "shippingAddressLine1"
    | "shippingAddressLine2"
    | "shippingCity"
    | "shippingState"
    | "shippingPhone";

export type BiasFieldValueMap = {
    country: string;
    postalCode: string;
    accountType: "checking" | "savings";
    accountHolderType: "individual" | "company";
    email: string;
    phone: string;
    name: string;
    firstName: string;
    lastName: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    shippingCountry: string;
    shippingPostalCode: string;
    shippingFirstName: string;
    shippingLastName: string;
    shippingAddressLine1: string;
    shippingAddressLine2: string;
    shippingCity: string;
    shippingState: string;
    shippingPhone: string;
};

export type ShopperCheckoutSessionUpdateParams = Pick<
    CheckoutSessionUpdateParams,
    "billing_details" | "customer_details" | "discounts" | "shipping_details" | "shipping_rate"
>;

export type BiasProviderOptions = {
    clientSecret: string;
    checkoutSessionExpand?: CheckoutSessionExpand;
    defaultValues?: Partial<BiasFieldValueMap>;
    rememberDetails?: boolean;
    savedPaymentMethods?: readonly SavedPaymentMethod[];
    appearance?: Appearance;
    onComplete?: () => void;
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
    discountCodeState: DiscountCodeState;
    detailsSaveState: DetailsSaveState;
    paymentMethod: PaymentMethod | undefined;
    walletAvailability: WalletAvailability;
    savedPaymentMethods: readonly SavedPaymentMethod[];
    savedPaymentMethod: SavedPaymentMethod | undefined;
    status: SubmissionStatus;
    canSubmit: boolean;
    submissionError: BiasElementsError | null;
};
