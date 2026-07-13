import { describe, expect, it } from "vitest";
import { themeVariableStyle } from "./theme-variables";
describe("themeVariableStyle", () => {
    it("returns empty object for undefined vars", () => {
        expect(themeVariableStyle(undefined)).toEqual({});
    });
    it("returns empty object for empty vars", () => {
        expect(themeVariableStyle({})).toEqual({});
    });
    it("converts camelCase keys to kebab CSS variables", () => {
        const result = themeVariableStyle({ colorPrimary: "#000" });
        expect(result).toEqual({ "--bias-color-primary": "#000" });
    });
    it("converts multiple variables", () => {
        const vars = {
            colorPrimary: "#000",
            colorBackground: "#fff",
            borderRadius: "8px",
        };
        const result = themeVariableStyle(vars);
        expect(result).toEqual({
            "--bias-color-primary": "#000",
            "--bias-color-background": "#fff",
            "--bias-border-radius": "8px",
        });
    });
    it("filters out null values", () => {
        const vars = {
            colorPrimary: "#000",
            colorBackground: null,
        };
        const result = themeVariableStyle(vars);
        expect(result).toEqual({ "--bias-color-primary": "#000" });
    });
    it("filters out undefined values", () => {
        const vars = {
            colorPrimary: "#000",
            colorBackground: undefined,
        };
        const result = themeVariableStyle(vars);
        expect(result).toEqual({ "--bias-color-primary": "#000" });
    });
    it("handles all theme variable keys", () => {
        const vars = {
            colorPrimary: "a",
            colorBackground: "b",
            colorInput: "c",
            colorForeground: "d",
            colorMutedForeground: "e",
            colorPlaceholder: "f",
            colorBorder: "g",
            colorSuccess: "h",
            colorError: "i",
            focusRing: "j",
            shadow: "k",
            borderRadius: "l",
            fontFamily: "m",
            fontSize: "n",
            gap: "o",
        };
        const result = themeVariableStyle(vars);
        expect(Object.keys(result)).toHaveLength(15);
        expect(result["--bias-color-muted-foreground"]).toBe("e");
        expect(result["--bias-focus-ring"]).toBe("j");
        expect(result["--bias-font-family"]).toBe("m");
        expect(result["--bias-gap"]).toBe("o");
    });
});
