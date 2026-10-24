import type { AppliedDiscount } from "@biaspay/sdk-checkout";

type EnteredDiscountCode = Pick<AppliedDiscount, "code">;

export function isEnteredDiscountCode(discount: EnteredDiscountCode) {
    return discount.code !== null;
}
