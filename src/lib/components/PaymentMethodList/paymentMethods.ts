import { BuildingLibrary, CreditCard } from "@steeze-ui/heroicons";
import { checkoutAmountRemaining } from "~/core";
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

/**
 * "Save $x" (or "Save x%" under a dollar) when paying with the method skips the
 * session's dual-pricing card markup.
 */
export function savingLabel(
    session: Parameters<typeof checkoutAmountRemaining>[0] | undefined,
    method: string,
): string | undefined {
    if (!session?.dual_pricing) return undefined;
    const cardAmount = checkoutAmountRemaining(session, "card");
    const saving = cardAmount - checkoutAmountRemaining(session, method);
    if (saving <= 0) return undefined;
    if (saving < 100) {
        const percent = (saving / cardAmount).toLocaleString("en-US", {
            style: "percent",
            maximumFractionDigits: 1,
        });
        return `Save ${percent}`;
    }
    return `Save ${(saving / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}`;
}
