import adapterStatic from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { EXAMPLES_BASE_PATH } from "./base-path.js";

/** @type {import('@sveltejs/kit').Config} */
const config = {
    // Consult https://github.com/sveltejs/svelte-preprocess
    // for more information about preprocessors
    preprocess: vitePreprocess({
        postcss: true,
    }),
    kit: {
        adapter: adapterStatic({
            fallback: "index.html",
        }),
        paths: {
            // Served by the Sockethub server under this prefix; the root URL
            // is the server info page.
            base: EXAMPLES_BASE_PATH,
        },
        alias: {
            $components: "src/components",
            "$components/*": "src/components/*",
            $lib: "src/lib",
            "$lib/*": "src/lib/*",
        },
    },
};

export default config;
