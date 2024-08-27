import { build, emptyDir } from "https://deno.land/x/dnt@0.37.0/mod.ts";

await emptyDir("./npm");

await build({
  entryPoints: ["./src/activity-streams.ts"],
  outDir: "./npm",
  shims: {
    deno: true,
  },
  package: {
    name: "activity-streams",
    version: Deno.args[0],
    description:
      "Boolean function that returns whether or not parameter is the number 42",
    license: "MIT",
  },
  postBuild() {
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});
