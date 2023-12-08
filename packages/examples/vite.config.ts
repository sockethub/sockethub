import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [sveltekit()],
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
