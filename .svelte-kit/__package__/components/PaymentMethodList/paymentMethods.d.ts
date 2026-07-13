import type { IconSource } from "../Icon/icon.ts";
export type PaymentMethod = "card" | "us_bank_account";
export declare function filterSupportedPaymentMethods(methods: readonly unknown[]): PaymentMethod[];
export declare const methodConfig: Record<PaymentMethod, {
    label: string;
    icon: IconSource;
}>;
