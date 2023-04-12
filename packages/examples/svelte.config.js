import adapter from "@sveltejs/adapter-static";
import preprocess from "svelte-preprocess";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://github.com/sveltejs/svelte-preprocess
  // for more information about preprocessors
  preprocess: preprocess({
    postcss: true,
  }),
  kit: {
    adapter: adapter(),
    paths: {
      base: "",
    },
    alias: {
      $components: "src/components",
      "$components/*": "src/components/*",
      $stores: "src/stores",
      "$stores/*": "src/stores/*",
      $lib: "src/lib",
      "$lib/*": "src/lib/*",
    },
  },
};

export default config;
