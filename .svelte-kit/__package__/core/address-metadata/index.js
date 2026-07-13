// Country-aware address form metadata, derived from Google's libaddressinput
// dataset (the data behind Chrome autofill / Android / Google Pay address forms).
// The country list and US record are vendored; other countries are fetched on
// demand from the gstatic CDN (CORS *, cacheable).
export * from "./countries";
const DEFAULT_POSTAL_CODE_LABEL = "Postal code";
const DEFAULT_POSTAL_CODE_ERROR = "Your postal code is invalid.";
const DEFAULT_STATE_LABEL = "Province";
const POSTAL_CODE_LABELS = {
    zip: "ZIP",
    postal: DEFAULT_POSTAL_CODE_LABEL,
    pin: "PIN",
    eircode: "Eircode",
};
const POSTAL_CODE_ERRORS = {
    zip: "Your ZIP code is invalid.",
    postal: DEFAULT_POSTAL_CODE_ERROR,
    pin: "Your PIN code is invalid.",
    eircode: "Your Eircode is invalid.",
};
const STATE_LABELS = {
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
export function parseAddressData(country, raw) {
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
export function fallbackAddressMetadata(country) {
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
export const ADDRESS_DATA_URL = "https://www.gstatic.com/chrome/autofill/libaddressinput/chromium-i18n/ssl-address/data";
// Vendored so the default country works synchronously and offline.
const US_ADDRESS_DATA = {
    fmt: "%N%n%O%n%A%n%C, %S %Z",
    require: "ACSZ",
    zip: "(\\d{5})(?:[ \\-](\\d{4}))?",
    zipex: "95014,22162-1010",
    zip_name_type: "zip",
    state_name_type: "state",
    sub_keys: "AL~AK~AS~AZ~AR~AA~AE~AP~CA~CO~CT~DE~DC~FL~GA~GU~HI~ID~IL~IN~IA~KS~KY~LA~ME~MH~MD~MA~MI~FM~MN~MS~MO~MT~NE~NV~NH~NJ~NM~NY~NC~ND~MP~OH~OK~OR~PW~PA~PR~RI~SC~SD~TN~TX~UT~VT~VI~VA~WA~WV~WI~WY",
    sub_names: "Alabama~Alaska~American Samoa~Arizona~Arkansas~Armed Forces (AA)~Armed Forces (AE)~Armed Forces (AP)~California~Colorado~Connecticut~Delaware~District of Columbia~Florida~Georgia~Guam~Hawaii~Idaho~Illinois~Indiana~Iowa~Kansas~Kentucky~Louisiana~Maine~Marshall Islands~Maryland~Massachusetts~Michigan~Micronesia~Minnesota~Mississippi~Missouri~Montana~Nebraska~Nevada~New Hampshire~New Jersey~New Mexico~New York~North Carolina~North Dakota~Northern Mariana Islands~Ohio~Oklahoma~Oregon~Palau~Pennsylvania~Puerto Rico~Rhode Island~South Carolina~South Dakota~Tennessee~Texas~Utah~Vermont~Virgin Islands~Virginia~Washington~West Virginia~Wisconsin~Wyoming",
};
const cache = new Map([["US", parseAddressData("US", US_ADDRESS_DATA)]]);
const inflight = new Map();
const fallbackCountries = new Set();
function normalizeCountry(country) {
    return country.trim().toUpperCase() || "ZZ";
}
/** Synchronous cache read; null until `loadAddressMetadata(country)` resolves. */
export function getAddressMetadata(country) {
    return cache.get(normalizeCountry(country)) ?? null;
}
export function getAddressMetadataStatus(country) {
    const normalized = normalizeCountry(country);
    if (fallbackCountries.has(normalized))
        return "fallback";
    return cache.has(normalized) ? "ready" : "loading";
}
/** Like `getAddressMetadata`, but returns fallback metadata instead of null. */
export function resolveAddressMetadata(country) {
    const normalized = normalizeCountry(country);
    return cache.get(normalized) ?? fallbackAddressMetadata(normalized);
}
/**
 * Fetch, parse, and cache a country's address metadata. Concurrent calls for
 * the same country share one request. Resolves with fallback metadata on
 * failure — the failure is cached so a dead endpoint isn't re-hit every render.
 */
export function loadAddressMetadata(country) {
    country = normalizeCountry(country);
    const cached = cache.get(country);
    if (cached)
        return Promise.resolve(cached);
    let pending = inflight.get(country);
    if (!pending) {
        pending = fetchAddressMetadata(country);
        inflight.set(country, pending);
    }
    return pending;
}
async function fetchAddressMetadata(country) {
    let metadata;
    try {
        const res = await fetch(`${ADDRESS_DATA_URL}/${encodeURIComponent(country)}`);
        if (!res.ok)
            throw new Error(`Address data request failed: ${res.status}`);
        metadata = parseAddressData(country, (await res.json()));
    }
    catch {
        metadata = fallbackAddressMetadata(country);
        fallbackCountries.add(country);
    }
    cache.set(country, metadata);
    inflight.delete(country);
    return metadata;
}
