import { BuildingLibrary, CreditCard } from "@steeze-ui/heroicons";
import type { IconSource } from "../Icon/icon.ts";

export type PaymentMethod = "card" | "us_bank_account";

export function filterSupportedPaymentMethods(methods: readonly unknown[]): PaymentMethod[] {
    return methods.filter(
        (method): method is PaymentMethod => method === "card" || method === "us_bank_account",
    );
}

export const methodConfig: Record<PaymentMethod, { label: string; icon: IconSource }> = {
    card: {
        label: "Card",
        icon: CreditCard as IconSource,
    },
    us_bank_account: {
        label: "US bank account",
        icon: BuildingLibrary as IconSource,
    },
};
