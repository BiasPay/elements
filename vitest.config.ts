import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

/**
 * The VM snapshot ships a pre-installed Chromium under $PLAYWRIGHT_BROWSERS_PATH
 * (browser build 1194) but the resolved Playwright may expect a different build.
 * Point Playwright at the installed full-Chromium binary when present so tests run
 * against the provisioned browser instead of trying to download one. When nothing
 * is found we fall back to Playwright's default resolution (portable for other envs).
 */
function findInstalledChromium(): string | undefined {
    const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
    if (!base || !existsSync(base)) {
        return undefined;
    }

    const candidate = readdirSync(base)
        .filter((entry) => /^chromium-\d+$/.test(entry))
        .map((entry) => join(base, entry, "chrome-linux", "chrome"))
        .find((path) => existsSync(path));

    return candidate;
}

const executablePath = findInstalledChromium();

export default defineConfig({
    // The Svelte plugin compiles `.svelte` components and rune-using `.svelte.ts`
    // helpers so tests can mount components and drive `$effect`/`$derived`.
    plugins: [svelte({ compilerOptions: { customElement: true } })],
    resolve: {
        alias: {
            "~": resolve(__dirname, "src/lib"),
        },
    },
    test: {
        watch: false,
        include: ["test/**/*.test.ts"],
        browser: {
            enabled: true,
            provider: playwright(executablePath ? { launchOptions: { executablePath } } : {}),
            instances: [{ browser: "chromium" }],
            headless: true,
        },
    },
});
