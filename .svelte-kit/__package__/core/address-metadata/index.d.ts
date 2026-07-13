export * from "./countries";
/**
 * Raw per-country record as served by the libaddressinput data service.
 * See https://github.com/google/libaddressinput/wiki/AddressValidationMetadata
 */
export type RawAddressData = {
    /** Field layout in local conventions, e.g. "%N%n%O%n%A%n%C, %S %Z". */
    fmt?: string;
    /** Latinized layout for countries whose fmt uses a non-latin script. */
    lfmt?: string;
    /** Required fields: A = street, C = city, S = state, Z = postal code. */
    require?: string;
    /** Postal code pattern (full-match, unanchored). */
    zip?: string;
    /** Comma-separated example postal codes. */
    zipex?: string;
    zip_name_type?: string;
    state_name_type?: string;
    /** `~`-separated subdivision keys (canonical values). */
    sub_keys?: string;
    /** `~`-separated subdivision names in the local script. */
    sub_names?: string;
    /** `~`-separated latinized subdivision names. */
    sub_lnames?: string;
};
export type AddressSubdivision = {
    /** Canonical value from the dataset, e.g. "CA", "Co. Cork", "東京都". */
    key: string;
    /** Latinized display name, e.g. "California", "Tokyo". */
    name: string;
};
export type AddressMetadata = {
    country: string;
    postalCode: {
        /** False when the country has no postal codes (e.g. AE, HK). */
        used: boolean;
        required: boolean;
        /** Field label: "ZIP", "Postal code", "PIN", "Eircode". */
        label: string;
        /** Error message for a value that fails the pattern. */
        error: string;
        regex: RegExp | null;
        /** Example postal code, e.g. "95014", "EC1Y 8SY". */
        example: string | null;
        /** True when postal codes are digit-only (numeric keyboards). */
        numeric: boolean;
    };
    state: {
        /** False when addresses have no state/province line (e.g. GB, DE). */
        used: boolean;
        required: boolean;
        /** Field label: "State", "Province", "Prefecture", "Emirate", ... */
        label: string;
        /** Subdivisions to offer in a select; empty when free-form. */
        options: AddressSubdivision[];
    };
    city: {
        /** False when addresses have no city line (e.g. AE). */
        used: boolean;
        required: boolean;
    };
};
export declare function parseAddressData(country: string, raw: RawAddressData): AddressMetadata;
/**
 * Metadata used before a country's data has loaded (or when it can't be
 * fetched). Deliberately permissive-but-complete: every field is shown and the
 * basics are required, so a fetch failure degrades validation, never the form.
 */
export declare function fallbackAddressMetadata(country: string): AddressMetadata;
export declare const ADDRESS_DATA_URL = "https://www.gstatic.com/chrome/autofill/libaddressinput/chromium-i18n/ssl-address/data";
/** Synchronous cache read; null until `loadAddressMetadata(country)` resolves. */
export declare function getAddressMetadata(country: string): AddressMetadata | null;
export declare function getAddressMetadataStatus(country: string): "loading" | "ready" | "fallback";
/** Like `getAddressMetadata`, but returns fallback metadata instead of null. */
export declare function resolveAddressMetadata(country: string): AddressMetadata;
/**
 * Fetch, parse, and cache a country's address metadata. Concurrent calls for
 * the same country share one request. Resolves with fallback metadata on
 * failure — the failure is cached so a dead endpoint isn't re-hit every render.
 */
export declare function loadAddressMetadata(country: string): Promise<AddressMetadata>;
