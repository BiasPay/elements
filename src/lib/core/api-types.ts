import type { Address } from "@biaspay/sdk";

export type AddressAutocompleteSuggestion = {
    label: string;
    secondary_label: string;
    full_address: string;
    components: {
        country?: { name?: string; code?: string };
        region?: { name?: string; code?: string };
        postal_code?: string;
        district?: string;
        place?: string;
        locality?: string;
        address?: string;
    };
};

export type AddressValidationResult = {
    verdict: "valid" | "suggestion" | "invalid" | "unverifiable";
    confidence?: "exact" | "high" | "medium" | "low";
    matches?: {
        postal_code?: "matched" | "unmatched";
        state?: "matched" | "unmatched";
    };
    suggested_address?: Address;
    reason?: "address_mismatch" | "postal_region_mismatch";
};

export type ApplePayWalletConfiguration = {
    enabled: boolean;
    country_code: "US";
    currency_code: "USD";
    supported_networks: ("visa" | "masterCard" | "amex" | "discover")[];
    merchant_capabilities: "supports3DS"[];
    display_name: string;
};
