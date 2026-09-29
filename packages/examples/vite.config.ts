import { sveltekit } from "@sveltejs/kit/vite";
import { fileURLToPath } from "node:url";
import { SERVER_ASSET_PATHS } from "./base-path.js";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [sveltekit()],
    resolve: {
        alias: {
            "@sockethub/schemas/examples-config": fileURLToPath(
                new URL("../schemas/src/examples-config.ts", import.meta.url),
            ),
            "@sockethub/schemas/service-descriptor": fileURLToPath(
                new URL(
                    "../schemas/src/service-descriptor.ts",
                    import.meta.url,
                ),
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
        // Branding assets live in the server package and are served from the
        // Sockethub root; when the app runs standalone, fetch them from the
        // server it is pointed at.
        proxy: Object.fromEntries(
            SERVER_ASSET_PATHS.map((assetPath) => [
                assetPath,
                "http://localhost:10550",
            ]),
        ),
    },
});
