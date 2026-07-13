import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
});

describe("development service endpoints", () => {
    it("uses local defaults when Vite variables are absent", async () => {
        vi.stubEnv("VITE_BIAS_API_URL", "");
        vi.stubEnv("VITE_BIAS_FIELD_FRAME_URL", "");
        vi.resetModules();
        const { resolveElementsConfig } = await import("./endpoints");

        expect(resolveElementsConfig({ clientSecret: "cs_test" })).toMatchObject({
            apiBaseUrl: "https://api.bias.localhost",
            frameUrl: "https://field.bias.localhost",
        });
    });

    it("uses endpoint values supplied by the Vite environment", async () => {
        vi.stubEnv("VITE_BIAS_API_URL", "https://api.dev.example");
        vi.stubEnv("VITE_BIAS_FIELD_FRAME_URL", "https://field.dev.example");
        vi.resetModules();
        const { resolveElementsConfig } = await import("./endpoints");

        expect(resolveElementsConfig({ clientSecret: "cs_test" })).toMatchObject({
            apiBaseUrl: "https://api.dev.example",
            frameUrl: "https://field.dev.example",
        });
    });
});
