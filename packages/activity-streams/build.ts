import { build, emptyDir } from "https://deno.land/x/dnt/mod.ts";

import packageJson from "./deno.json" with { type: "json" };

await emptyDir("./npm");

await build({
  scriptModule: false,
  typeCheck: false,
  entryPoints: [packageJson.exports],
  outDir: "./npm",
  shims: {
    deno: true,
  },
  package: {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    license: packageJson.license
  },
  postBuild() {
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});
