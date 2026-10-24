import type * as Checkout from "@biaspay/sdk-checkout";
import { expectTypeOf, test } from "vitest";
import type * as Local from "./api-types";

test("Elements' API types match the checkout SDK", () => {
    expectTypeOf<Local.AddressAutocompleteSuggestion>().toEqualTypeOf<Checkout.AddressAutocompleteSuggestion>();
    expectTypeOf<Local.AddressValidationResult>().toEqualTypeOf<Checkout.AddressValidationResult>();
    expectTypeOf<Local.ApplePayWalletConfiguration>().toEqualTypeOf<Checkout.ApplePayWalletConfiguration>();
});
