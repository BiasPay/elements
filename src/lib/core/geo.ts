export const GEO_LOOKUP_URL = "https://ipinfo.io/json";

export type GeoLocation = {
    /** ISO 3166-1 alpha-2 country code, e.g. "US". */
    country: string | null;
    /** Region / state display name, e.g. "California". */
    region: string | null;
};

let lookup: Promise<GeoLocation | null> | null = null;

/**
 * Best-effort IP geolocation via ipinfo.io, used to pick smarter form
 * defaults. Resolves null on any failure; the result is cached for the
 * session.
 */
export function detectGeoLocation(): Promise<GeoLocation | null> {
    lookup ??= (async () => {
        try {
            const res = await fetch(GEO_LOOKUP_URL);
            if (!res.ok) return null;
            const data = (await res.json()) as { country?: string; region?: string };
            return {
                country: data.country?.toUpperCase() ?? null,
                region: data.region ?? null,
            };
        } catch {
            return null;
        }
    })();
    return lookup;
}
