import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import adapterStatic from "@sveltejs/adapter-static";

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
            base: "",
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
