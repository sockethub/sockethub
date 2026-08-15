import { sveltekit } from "@sveltejs/kit/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [sveltekit()],
    resolve: {
        alias: {
            "@sockethub/schemas/examples-config": fileURLToPath(
                new URL("../schemas/src/examples-config.ts", import.meta.url),
            ),
        },
    },
    optimizeDeps: {
        include: ["highlight.js", "highlight.js/lib/core", "@sockethub/client"],
    },
    test: {
        include: ["src/**/*.{test,spec}.{js,ts}"],
    },
    server: {
        strictPort: true,
        port: 10551,
    },
});
