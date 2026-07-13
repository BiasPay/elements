import { afterEach, describe, expect, it, vi } from "vitest";
import {
    ADDRESS_DATA_URL,
    COUNTRY_NAMES,
    fallbackAddressMetadata,
    getAddressMetadata,
    getCountryOptions,
    loadAddressMetadata,
    parseAddressData,
    resolveAddressMetadata,
    type RawAddressData,
} from "./index";

// Real records from the libaddressinput dataset.
const GB_DATA: RawAddressData = {
    fmt: "%N%n%O%n%A%n%C%n%Z",
    require: "ACZ",
    zip: "GIR ?0AA|(?:(?:AB|AL|B|BA|BB|BD|BF|BH|BL|BN|BR|BS|BT|BX|CA|CB|CF|CH|CM|CO|CR|CT|CV|CW|DA|DD|DE|DG|DH|DL|DN|DT|DY|E|EC|EH|EN|EX|FK|FY|G|GL|GY|GU|HA|HD|HG|HP|HR|HS|HU|HX|IG|IM|IP|IV|JE|KA|KT|KW|KY|L|LA|LD|LE|LL|LN|LS|LU|M|ME|MK|ML|N|NE|NG|NN|NP|NR|NW|OL|OX|PA|PE|PH|PL|PO|PR|RG|RH|RM|S|SA|SE|SG|SK|SL|SM|SN|SO|SP|SR|SS|ST|SW|SY|TA|TD|TF|TN|TQ|TR|TS|TW|UB|W|WA|WC|WD|WF|WN|WR|WS|WV|YO|ZE)(?:\\d[\\dA-Z]? ?\\d[ABD-HJLN-UW-Z]{2}))|BFPO ?\\d{1,4}",
    zipex: "EC1Y 8SY,GIR 0AA,M2 5BQ",
};

const JP_DATA: RawAddressData = {
    fmt: "〒%Z%n%S%n%A%n%O%n%N",
    lfmt: "%N%n%O%n%A, %S%n%Z",
    require: "ASZ",
    zip: "\\d{3}-?\\d{4}",
    zipex: "154-0023,350-1106",
    state_name_type: "prefecture",
    sub_keys: "北海道~青森県~東京都",
    sub_lnames: "Hokkaido~Aomori~Tokyo",
};

const AE_DATA: RawAddressData = {
    fmt: "%N%n%O%n%A%n%S",
    lfmt: "%N%n%O%n%A%n%S",
    require: "AS",
    state_name_type: "emirate",
    sub_keys: "أبو ظبي~إمارة دبيّ",
    sub_names: "أبو ظبي~دبي",
    sub_lnames: "Abu Dhabi~Dubai",
};

const IE_DATA: RawAddressData = {
    fmt: "%N%n%O%n%A%n%D%n%C%n%S%n%Z",
    zip: "[\\dA-Z]{3} ?[\\dA-Z]{4}",
    zipex: "A65 F4E2",
    zip_name_type: "eircode",
    state_name_type: "county",
    sub_keys: "Co. Carlow~Co. Cavan",
};

describe("parseAddressData", () => {
    it("parses a fully-specified country (GB: postal code, no state)", () => {
        const metadata = parseAddressData("GB", GB_DATA);
        expect(metadata.postalCode.used).toBe(true);
        expect(metadata.postalCode.required).toBe(true);
        expect(metadata.postalCode.label).toBe("Postal code");
        expect(metadata.postalCode.example).toBe("EC1Y 8SY");
        expect(metadata.postalCode.numeric).toBe(false);
        expect(metadata.postalCode.regex?.test("EC1Y 8SY")).toBe(true);
        expect(metadata.postalCode.regex?.test("12345")).toBe(false);
        expect(metadata.state.used).toBe(false);
        expect(metadata.state.required).toBe(false);
        expect(metadata.city.used).toBe(true);
        expect(metadata.city.required).toBe(true);
    });

    it("uses the latinized format and subdivision names (JP)", () => {
        const metadata = parseAddressData("JP", JP_DATA);
        expect(metadata.state.used).toBe(true);
        expect(metadata.state.required).toBe(true);
        expect(metadata.state.label).toBe("Prefecture");
        expect(metadata.state.options).toEqual([
            { key: "北海道", name: "Hokkaido" },
            { key: "青森県", name: "Aomori" },
            { key: "東京都", name: "Tokyo" },
        ]);
        // Dashed postal codes get a text keyboard so the dash stays typable.
        expect(metadata.postalCode.numeric).toBe(false);
        expect(metadata.postalCode.regex?.test("154-0023")).toBe(true);
    });

    it("handles countries without city or postal code lines (AE)", () => {
        const metadata = parseAddressData("AE", AE_DATA);
        expect(metadata.postalCode.used).toBe(false);
        expect(metadata.postalCode.required).toBe(false);
        expect(metadata.city.used).toBe(false);
        expect(metadata.city.required).toBe(false);
        expect(metadata.state.used).toBe(true);
        expect(metadata.state.required).toBe(true);
        expect(metadata.state.label).toBe("Emirate");
        expect(metadata.state.options[0]).toEqual({ key: "أبو ظبي", name: "Abu Dhabi" });
    });

    it("handles optional postal codes and custom labels (IE)", () => {
        const metadata = parseAddressData("IE", IE_DATA);
        expect(metadata.postalCode.used).toBe(true);
        expect(metadata.postalCode.required).toBe(false);
        expect(metadata.postalCode.label).toBe("Eircode");
        expect(metadata.postalCode.error).toBe("Your Eircode is invalid.");
        expect(metadata.state.label).toBe("County");
        expect(metadata.state.required).toBe(false);
    });

    it("applies ZZ defaults for empty records", () => {
        const metadata = parseAddressData("XX", {});
        expect(metadata.postalCode.used).toBe(false);
        expect(metadata.state.used).toBe(false);
        expect(metadata.city.used).toBe(true);
        expect(metadata.city.required).toBe(true);
        expect(metadata.postalCode.label).toBe("Postal code");
        expect(metadata.state.label).toBe("Province");
    });
});

describe("vendored US metadata", () => {
    it("is available synchronously", () => {
        const metadata = getAddressMetadata("US");
        expect(metadata).not.toBeNull();
        expect(metadata?.postalCode.label).toBe("ZIP");
        expect(metadata?.postalCode.numeric).toBe(true);
        expect(metadata?.postalCode.regex?.test("95014")).toBe(true);
        expect(metadata?.postalCode.regex?.test("22162-1010")).toBe(true);
        expect(metadata?.postalCode.regex?.test("1234")).toBe(false);
        expect(metadata?.state.label).toBe("State");
        expect(metadata?.state.required).toBe(true);
        expect(metadata?.state.options).toContainEqual({ key: "CA", name: "California" });
        expect(metadata?.state.options).toHaveLength(62);
    });
});

describe("fallbackAddressMetadata", () => {
    it("shows every field and requires the basics", () => {
        const metadata = fallbackAddressMetadata("FR");
        expect(metadata.postalCode.used).toBe(true);
        expect(metadata.postalCode.required).toBe(true);
        expect(metadata.postalCode.regex).toBeNull();
        expect(metadata.state.used).toBe(true);
        expect(metadata.state.required).toBe(false);
        expect(metadata.city.required).toBe(true);
    });

    it("keeps the legacy US/CA behavior", () => {
        expect(fallbackAddressMetadata("US").state.required).toBe(true);
        expect(fallbackAddressMetadata("US").postalCode.label).toBe("ZIP");
        expect(fallbackAddressMetadata("CA").state.required).toBe(true);
        expect(fallbackAddressMetadata("CA").state.label).toBe("Province");
    });
});

describe("loadAddressMetadata", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("fetches, parses, and caches a country", async () => {
        const fetchMock = vi.fn(async (url: string) => {
            expect(url).toBe(`${ADDRESS_DATA_URL}/DE`);
            return {
                ok: true,
                json: async () => ({
                    fmt: "%N%n%O%n%A%n%Z %C",
                    require: "ACZ",
                    zip: "\\d{5}",
                    zipex: "26133,53225",
                }),
            };
        });
        vi.stubGlobal("fetch", fetchMock);

        const metadata = await loadAddressMetadata("DE");
        expect(metadata.postalCode.regex?.test("26133")).toBe(true);
        expect(metadata.postalCode.numeric).toBe(true);
        expect(metadata.state.used).toBe(false);

        // Second call is a cache hit
        expect(await loadAddressMetadata("DE")).toBe(metadata);
        expect(getAddressMetadata("DE")).toBe(metadata);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("shares one request between concurrent calls", async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            json: async () => ({ fmt: "%N%n%A%n%Z %C", zip: "\\d{4}" }),
        }));
        vi.stubGlobal("fetch", fetchMock);

        const [a, b] = await Promise.all([loadAddressMetadata("AT"), loadAddressMetadata("AT")]);
        expect(a).toBe(b);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("resolves with cached fallback metadata when the fetch fails", async () => {
        const fetchMock = vi.fn(async () => {
            throw new Error("offline");
        });
        vi.stubGlobal("fetch", fetchMock);

        const metadata = await loadAddressMetadata("BR");
        expect(metadata).toEqual(fallbackAddressMetadata("BR"));
        expect(resolveAddressMetadata("BR")).toBe(metadata);
        await loadAddressMetadata("BR");
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});

describe("country list", () => {
    it("contains the expected regions", () => {
        expect(COUNTRY_NAMES.US).toBe("United States");
        expect(COUNTRY_NAMES.JP).toBe("Japan");
        expect(Object.keys(COUNTRY_NAMES).length).toBe(237);
    });

    it("returns options sorted by display name", () => {
        const options = getCountryOptions();
        const names = options.map((o) => o.name);
        expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
        expect(options.find((o) => o.code === "GB")?.name).toBe("United Kingdom");
    });
});
