/** The billing/payment slot each address value field maps to per scope. */
const SHIPPING_FIELD_MAP = {
    country: "shippingCountry",
    postalCode: "shippingPostalCode",
    name: "shippingName",
    addressLine1: "shippingAddressLine1",
    addressLine2: "shippingAddressLine2",
    city: "shippingCity",
    state: "shippingState",
    phone: "shippingPhone",
};
/**
 * Resolve a logical address field type to its concrete field slot for a scope.
 * Billing fields keep their unprefixed names (shared with the payment method);
 * shipping fields map to their `shipping*` counterparts.
 */
export function scopedField(type, scope) {
    if (scope === "billing")
        return type;
    return SHIPPING_FIELD_MAP[type] ?? type;
}
