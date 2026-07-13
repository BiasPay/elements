import { BuildingLibrary, CreditCard } from "@steeze-ui/heroicons";
export function filterSupportedPaymentMethods(methods) {
    return methods.filter((method) => method === "card" || method === "us_bank_account");
}
export const methodConfig = {
    card: {
        label: "Card",
        icon: CreditCard,
    },
    us_bank_account: {
        label: "US bank account",
        icon: BuildingLibrary,
    },
};
