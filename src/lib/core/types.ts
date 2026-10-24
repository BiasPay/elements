import type { ThemeVariables } from "./theme-variables";

// ---------------------------------------------------------------------------
// Frame message protocol (iframe <-> host communication)
// ---------------------------------------------------------------------------

export type FrameFieldType =
    | "cardNumber"
    | "cardExpiry"
    | "cardCvc"
    | "bankAccountNumber"
    | "bankRoutingNumber";

type ReadyMessage = { type: "ready" };
type ErrorMessage = { type: "error"; error: string | null };
type CardBrandMessage = { type: "cardBrand"; brand: string | null };
type FocusMessage = { type: "focus" };
type BlurMessage = { type: "blur" };
type EmptyMessage = { type: "empty"; empty: boolean };
type EncryptedDataMessage = {
    type: "encryptedData";
    field: FrameFieldType;
    encryptedValue: string | null;
};

export type FrameMessage =
    | ReadyMessage
    | ErrorMessage
    | CardBrandMessage
    | FocusMessage
    | BlurMessage
    | EmptyMessage
    | EncryptedDataMessage;

// ---------------------------------------------------------------------------
// Field state
// ---------------------------------------------------------------------------

export type BiasFieldStatus = {
    loading: boolean;
    focused: boolean;
    empty: boolean;
    valid: boolean;
    error: string | null;
    /** The card brand string as reported by the iframe field, e.g. "visa", "american-express". */
    cardBrand: string | null;
};

export type ValueFieldStatus<T = string> = {
    value: T;
    focused: boolean;
    valid: boolean;
    error: string | null;
};

// ---------------------------------------------------------------------------
// Field types & value map
// ---------------------------------------------------------------------------

/**
 * The value fields that make up an address. An address form collects these
 * for either the billing or the shipping scope; the two scopes have fully
 * independent state (see {@link AddressScope} and the `shipping*` field types).
 */
export type AddressValueFieldType =
    | "country"
    | "postalCode"
    | "firstName"
    | "lastName"
    | "addressLine1"
    | "addressLine2"
    | "city"
    | "state";

export type FieldType =
    | FrameFieldType
    | AddressValueFieldType
    | "accountType"
    | "accountHolderType"
    | "email"
    | "phone"
    | "name"
    // Shipping-scoped address fields. Kept separate from the billing/payment
    // fields above so a shipping and a billing address form can coexist.
    | "shippingCountry"
    | "shippingPostalCode"
    | "shippingFirstName"
    | "shippingLastName"
    | "shippingAddressLine1"
    | "shippingAddressLine2"
    | "shippingCity"
    | "shippingState"
    | "shippingPhone";

export type FieldValueMap = {
    cardNumber: never;
    cardExpiry: never;
    cardCvc: never;
    bankAccountNumber: never;
    bankRoutingNumber: never;
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

/** Fields a contact details element can collect. */
export type ContactFieldType = "email" | "phone";

export type ValueFieldType = {
    [K in FieldType]: FieldValueMap[K] extends never ? never : K;
}[FieldType];

export type UnifiedFieldState = {
    cardNumber: BiasFieldStatus;
    cardExpiry: BiasFieldStatus;
    cardCvc: BiasFieldStatus;
    bankAccountNumber: BiasFieldStatus;
    bankRoutingNumber: BiasFieldStatus;
    country: ValueFieldStatus<string>;
    postalCode: ValueFieldStatus<string>;
    accountType: ValueFieldStatus<"checking" | "savings">;
    accountHolderType: ValueFieldStatus<"individual" | "company">;
    email: ValueFieldStatus<string>;
    phone: ValueFieldStatus<string>;
    name: ValueFieldStatus<string>;
    firstName: ValueFieldStatus<string>;
    lastName: ValueFieldStatus<string>;
    addressLine1: ValueFieldStatus<string>;
    addressLine2: ValueFieldStatus<string>;
    city: ValueFieldStatus<string>;
    state: ValueFieldStatus<string>;
    shippingCountry: ValueFieldStatus<string>;
    shippingPostalCode: ValueFieldStatus<string>;
    shippingFirstName: ValueFieldStatus<string>;
    shippingLastName: ValueFieldStatus<string>;
    shippingAddressLine1: ValueFieldStatus<string>;
    shippingAddressLine2: ValueFieldStatus<string>;
    shippingCity: ValueFieldStatus<string>;
    shippingState: ValueFieldStatus<string>;
    shippingPhone: ValueFieldStatus<string>;
};

// ---------------------------------------------------------------------------
// Address scope
// ---------------------------------------------------------------------------

/**
 * Which independent address a form collects. Billing shares its country and
 * postal code with the payment method; shipping is fully separate.
 */
export type AddressScope = "billing" | "shipping";

/** The billing/payment slot each address value field maps to per scope. */
const SHIPPING_FIELD_MAP: Record<AddressValueFieldType, ValueFieldType> = {
    country: "shippingCountry",
    postalCode: "shippingPostalCode",
    firstName: "shippingFirstName",
    lastName: "shippingLastName",
    addressLine1: "shippingAddressLine1",
    addressLine2: "shippingAddressLine2",
    city: "shippingCity",
    state: "shippingState",
};

/**
 * Resolve a logical address field type to its concrete field slot for a scope.
 * Billing fields keep their unprefixed names; shipping fields map to their
 * `shipping*` counterparts.
 */
export function scopedField(type: ValueFieldType, scope: AddressScope): ValueFieldType {
    if (scope === "billing") return type;
    return SHIPPING_FIELD_MAP[type as AddressValueFieldType] ?? type;
}

// ---------------------------------------------------------------------------
// Payment method
// ---------------------------------------------------------------------------

export type ConventionalPaymentMethodType = "card" | "us_bank_account";
export type WalletPaymentMethodType = "apple_pay";
export type SessionPaymentMethodType = ConventionalPaymentMethodType | WalletPaymentMethodType;
/** Methods whose details are collected by BiasStore. */
export type PaymentMethodType = ConventionalPaymentMethodType;

// ---------------------------------------------------------------------------
// Label style
// ---------------------------------------------------------------------------

export type LabelStyle = "static" | "floating" | "placeholder";

// ---------------------------------------------------------------------------
// Payment method list style
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Appearance
// ---------------------------------------------------------------------------

export type Appearance = {
    variables?: ThemeVariables;
    labelStyle?: LabelStyle;
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ValueFieldValidationOptions = {
    showRequired: boolean;
};

export type ValueFieldValidationResult = {
    valid: boolean;
    error: string | null;
};

export type ValueFieldValidator<K extends ValueFieldType> = (
    value: FieldValueMap[K],
    options: ValueFieldValidationOptions,
) => ValueFieldValidationResult;
