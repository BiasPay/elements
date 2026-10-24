import type { CountryCode } from "@biaspay/sdk";

export function filterAllowedCountries<T extends { code: string }>(
    countries: T[],
    allowedCountries?: CountryCode[],
) {
    if (allowedCountries === undefined) return countries;
    return countries.filter((country) => allowedCountries.includes(country.code as CountryCode));
}

export function correctAllowedCountry(country: string, allowedCountries?: CountryCode[]) {
    if (!allowedCountries?.length || allowedCountries.includes(country as CountryCode)) {
        return country;
    }
    return allowedCountries[0];
}
