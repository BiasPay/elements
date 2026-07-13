// Country-aware address form metadata, derived from Google's libaddressinput
// dataset (the data behind Chrome autofill / Android / Google Pay address forms).
// The country list and US record are vendored; other countries are fetched on
// demand from the gstatic CDN (CORS *, cacheable).

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

const DEFAULT_POSTAL_CODE_LABEL = "Postal code";
const DEFAULT_POSTAL_CODE_ERROR = "Your postal code is invalid.";
const DEFAULT_STATE_LABEL = "Province";

const POSTAL_CODE_LABELS: Record<string, string> = {
    zip: "ZIP",
    postal: DEFAULT_POSTAL_CODE_LABEL,
    pin: "PIN",
    eircode: "Eircode",
};

const POSTAL_CODE_ERRORS: Record<string, string> = {
    zip: "Your ZIP code is invalid.",
    postal: DEFAULT_POSTAL_CODE_ERROR,
    pin: "Your PIN code is invalid.",
    eircode: "Your Eircode is invalid.",
};

const STATE_LABELS: Record<string, string> = {
    area: "Area",
    county: "County",
    department: "Department",
    district: "District",
    do_si: "Province",
    emirate: "Emirate",
    island: "Island",
    oblast: "Oblast",
    parish: "Parish",
    prefecture: "Prefecture",
    province: "Province",
    state: "State",
};

// The dataset's ZZ (unknown region) defaults.
const DEFAULT_FMT = "%N%n%O%n%A%n%C";
const DEFAULT_REQUIRE = "AC";

export function parseAddressData(country: string, raw: RawAddressData): AddressMetadata {
    const fmt = raw.lfmt ?? raw.fmt ?? DEFAULT_FMT;
    const require = raw.require ?? DEFAULT_REQUIRE;
    const zipNameType = raw.zip_name_type ?? "postal";
    const stateNameType = raw.state_name_type ?? "province";

    const example = raw.zipex?.split(",")[0]?.trim() || null;
    const keys = raw.sub_keys ? raw.sub_keys.split("~") : [];
    const names = (raw.sub_lnames ?? raw.sub_names)?.split("~") ?? [];

    return {
        country,
        postalCode: {
            used: fmt.includes("%Z"),
            required: require.includes("Z"),
            label: POSTAL_CODE_LABELS[zipNameType] ?? DEFAULT_POSTAL_CODE_LABEL,
            error: POSTAL_CODE_ERRORS[zipNameType] ?? DEFAULT_POSTAL_CODE_ERROR,
            regex: raw.zip ? new RegExp(`^(?:${raw.zip})$`) : null,
            example,
            numeric: example !== null && /^\d+$/.test(example),
        },
        state: {
            used: fmt.includes("%S"),
            required: require.includes("S"),
            label: STATE_LABELS[stateNameType] ?? DEFAULT_STATE_LABEL,
            options: keys.map((key, i) => ({ key, name: names[i] || key })),
        },
        city: {
            used: fmt.includes("%C"),
            required: require.includes("C"),
        },
    };
}

/**
 * Metadata used before a country's data has loaded (or when it can't be
 * fetched). Deliberately permissive-but-complete: every field is shown and the
 * basics are required, so a fetch failure degrades validation, never the form.
 */
export function fallbackAddressMetadata(country: string): AddressMetadata {
    return {
        country,
        postalCode: {
            used: true,
            required: true,
            label: country === "US" ? "ZIP" : DEFAULT_POSTAL_CODE_LABEL,
            error: country === "US" ? "Your ZIP code is invalid." : DEFAULT_POSTAL_CODE_ERROR,
            regex: null,
            example: null,
            numeric: false,
        },
        state: {
            used: true,
            required: country === "US" || country === "CA",
            label: country === "CA" ? "Province" : country === "US" ? "State" : "State / Province",
            options: [],
        },
        city: { used: true, required: true },
    };
}

export const ADDRESS_DATA_URL =
    "https://www.gstatic.com/chrome/autofill/libaddressinput/chromium-i18n/ssl-address/data";

// Vendored so the default country works synchronously and offline.
const US_ADDRESS_DATA: RawAddressData = {
    fmt: "%N%n%O%n%A%n%C, %S %Z",
    require: "ACSZ",
    zip: "(\\d{5})(?:[ \\-](\\d{4}))?",
    zipex: "95014,22162-1010",
    zip_name_type: "zip",
    state_name_type: "state",
    sub_keys:
        "AL~AK~AS~AZ~AR~AA~AE~AP~CA~CO~CT~DE~DC~FL~GA~GU~HI~ID~IL~IN~IA~KS~KY~LA~ME~MH~MD~MA~MI~FM~MN~MS~MO~MT~NE~NV~NH~NJ~NM~NY~NC~ND~MP~OH~OK~OR~PW~PA~PR~RI~SC~SD~TN~TX~UT~VT~VI~VA~WA~WV~WI~WY",
    sub_names:
        "Alabama~Alaska~American Samoa~Arizona~Arkansas~Armed Forces (AA)~Armed Forces (AE)~Armed Forces (AP)~California~Colorado~Connecticut~Delaware~District of Columbia~Florida~Georgia~Guam~Hawaii~Idaho~Illinois~Indiana~Iowa~Kansas~Kentucky~Louisiana~Maine~Marshall Islands~Maryland~Massachusetts~Michigan~Micronesia~Minnesota~Mississippi~Missouri~Montana~Nebraska~Nevada~New Hampshire~New Jersey~New Mexico~New York~North Carolina~North Dakota~Northern Mariana Islands~Ohio~Oklahoma~Oregon~Palau~Pennsylvania~Puerto Rico~Rhode Island~South Carolina~South Dakota~Tennessee~Texas~Utah~Vermont~Virgin Islands~Virginia~Washington~West Virginia~Wisconsin~Wyoming",
};

const cache = new Map<string, AddressMetadata>([["US", parseAddressData("US", US_ADDRESS_DATA)]]);
const inflight = new Map<string, Promise<AddressMetadata>>();
const fallbackCountries = new Set<string>();

function normalizeCountry(country: string): string {
    return country.trim().toUpperCase() || "ZZ";
}

/** Synchronous cache read; null until `loadAddressMetadata(country)` resolves. */
export function getAddressMetadata(country: string): AddressMetadata | null {
    return cache.get(normalizeCountry(country)) ?? null;
}

export function getAddressMetadataStatus(country: string): "loading" | "ready" | "fallback" {
    const normalized = normalizeCountry(country);
    if (fallbackCountries.has(normalized)) return "fallback";
    return cache.has(normalized) ? "ready" : "loading";
}

/** Like `getAddressMetadata`, but returns fallback metadata instead of null. */
export function resolveAddressMetadata(country: string): AddressMetadata {
    const normalized = normalizeCountry(country);
    return cache.get(normalized) ?? fallbackAddressMetadata(normalized);
}

/**
 * Fetch, parse, and cache a country's address metadata. Concurrent calls for
 * the same country share one request. Resolves with fallback metadata on
 * failure — the failure is cached so a dead endpoint isn't re-hit every render.
 */
export function loadAddressMetadata(country: string): Promise<AddressMetadata> {
    country = normalizeCountry(country);
    const cached = cache.get(country);
    if (cached) return Promise.resolve(cached);

    let pending = inflight.get(country);
    if (!pending) {
        pending = fetchAddressMetadata(country);
        inflight.set(country, pending);
    }
    return pending;
}

async function fetchAddressMetadata(country: string): Promise<AddressMetadata> {
    let metadata: AddressMetadata;
    try {
        const res = await fetch(`${ADDRESS_DATA_URL}/${encodeURIComponent(country)}`);
        if (!res.ok) throw new Error(`Address data request failed: ${res.status}`);
        metadata = parseAddressData(country, (await res.json()) as RawAddressData);
    } catch {
        metadata = fallbackAddressMetadata(country);
        fallbackCountries.add(country);
    }
    cache.set(country, metadata);
    inflight.delete(country);
    return metadata;
}
