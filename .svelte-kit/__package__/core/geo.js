export const GEO_LOOKUP_URL = "https://ipinfo.io/json";
let lookup = null;
/**
 * Best-effort IP geolocation via ipinfo.io, used to pick smarter form
 * defaults. Resolves null on any failure; the result is cached for the
 * session.
 */
export function detectGeoLocation() {
    lookup ??= (async () => {
        try {
            const res = await fetch(GEO_LOOKUP_URL);
            if (!res.ok)
                return null;
            const data = (await res.json());
            return {
                country: data.country?.toUpperCase() ?? null,
                region: data.region ?? null,
            };
        }
        catch {
            return null;
        }
    })();
    return lookup;
}
