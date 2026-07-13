import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        watch: false,
        environment: "jsdom",
        include: ["src/lib/core/**/*.test.ts"],
    },
});
