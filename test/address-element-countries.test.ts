import { describe, expect, it } from "vitest";
import {
    correctAllowedCountry,
    filterAllowedCountries,
} from "../src/lib/components/AddressElement/countries";
import { getCountryOptions } from "../src/lib/core/address-metadata";

describe("AddressElement allowed countries", () => {
    const countries = [
        { code: "US", name: "United States" },
        { code: "CA", name: "Canada" },
        { code: "GB", name: "United Kingdom" },
    ];

    it("filters the country selector to configured countries", () => {
        expect(filterAllowedCountries(countries, ["CA", "US"])).toEqual([
            countries[0],
            countries[1],
        ]);
    });

    it("keeps a valid selection and corrects an invalid selection", () => {
        expect(correctAllowedCountry("CA", ["US", "CA"])).toBe("CA");
        expect(correctAllowedCountry("GB", ["US", "CA"])).toBe("US");
    });

    it("includes every SDK country omitted by the original selector catalog", () => {
        const allowedCountries = [
            "AS",
            "CC",
            "CU",
            "CX",
            "FM",
            "HM",
            "IR",
            "KP",
            "MH",
            "MP",
            "NF",
            "PW",
            "SY",
            "UM",
            "VI",
        ] as const;

        const filteredCodes = filterAllowedCountries(getCountryOptions(), [
            ...allowedCountries,
        ]).map(({ code }) => code);

        expect(filteredCodes.sort()).toEqual([...allowedCountries].sort());
    });
});
