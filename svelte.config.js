import { fileURLToPath } from "node:url";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const libDir = fileURLToPath(new URL("./src/lib", import.meta.url));

export default {
    preprocess: vitePreprocess(),
    compilerOptions: {
        // Opt every component into runes mode.
        runes: true,
        customElement: true,
    },
    // Read by `svelte-package` (not just full SvelteKit apps) to rewrite
    // aliased imports to relative paths in the published dist output.
    kit: {
        alias: {
            "~": libDir,
            "~/*": `${libDir}/*`,
        },
    },
};
