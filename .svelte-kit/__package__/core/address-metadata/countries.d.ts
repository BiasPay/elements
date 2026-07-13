/** ISO 3166-1 alpha-2 region code -> English display name. */
export declare const COUNTRY_NAMES: Record<string, string>;
export type CountryOption = {
    code: string;
    name: string;
};
/** Country options sorted by display name, for select inputs. */
export declare function getCountryOptions(): CountryOption[];
