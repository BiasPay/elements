import { resolve } from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
    const remoteDevelopmentHost = loadEnv(
        mode,
        resolve(__dirname, "../../../.."),
        "",
    ).REMOTE_DEVELOPMENT_URL;

    return {
        plugins: [svelte({ compilerOptions: { customElement: true } }), tailwindcss()],
        resolve: {
            alias: {
                "~": resolve(__dirname, "../src/lib"),
            },
        },
        server: {
            allowedHosts: remoteDevelopmentHost ? [remoteDevelopmentHost] : [],
        },
    };
});
