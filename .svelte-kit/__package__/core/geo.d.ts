export declare const GEO_LOOKUP_URL = "https://ipinfo.io/json";
export type GeoLocation = {
    /** ISO 3166-1 alpha-2 country code, e.g. "US". */
    country: string | null;
    /** Region / state display name, e.g. "California". */
    region: string | null;
};
/**
 * Best-effort IP geolocation via ipinfo.io, used to pick smarter form
 * defaults. Resolves null on any failure; the result is cached for the
 * session.
 */
export declare function detectGeoLocation(): Promise<GeoLocation | null>;
