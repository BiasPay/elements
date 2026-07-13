import { resolve } from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import cssInjectedByJs from "vite-plugin-css-injected-by-js";

export default defineConfig(({ mode }) => {
    const isDevelopment = mode === "development";
    const developmentEnv = loadEnv(mode, resolve(__dirname, "dev"), "VITE_BIAS_");

    return {
        // Compiled component styles are injected by the JS bundle at import time, so
        // consumers just import the package entry — no separate stylesheet import and
        // no Svelte compiler on their side (dist ships pre-compiled JS).
        plugins: [
            svelte({ compilerOptions: { customElement: true } }),
            tailwindcss(),
            cssInjectedByJs(),
        ],
        resolve: {
            alias: {
                "~": resolve(__dirname, "src/lib"),
            },
        },
        define: isDevelopment
            ? {
                  "import.meta.env.DEV": "true",
                  "import.meta.env.PROD": "false",
                  "import.meta.env.VITE_BIAS_API_URL": JSON.stringify(
                      developmentEnv.VITE_BIAS_API_URL || "https://api.bias.localhost",
                  ),
                  "import.meta.env.VITE_BIAS_FIELD_FRAME_URL": JSON.stringify(
                      developmentEnv.VITE_BIAS_FIELD_FRAME_URL || "https://field.bias.localhost",
                  ),
              }
            : undefined,
        build: {
            emptyOutDir: !isDevelopment,
            lib: {
                entry: resolve(__dirname, "src/lib/index.ts"),
                name: "BiasSvelte",
                fileName: isDevelopment ? "development" : "index",
                formats: ["es"],
            },
            rollupOptions: {
                // The web package owns one shared renderer runtime. Consumers only
                // provide the public Bias SDK dependency.
                external: ["@biaspay/sdk"],
                output: isDevelopment
                    ? {
                          chunkFileNames: "development/[name]-[hash].js",
                          assetFileNames: "development/[name]-[hash][extname]",
                      }
                    : undefined,
            },
        },
    };
});
