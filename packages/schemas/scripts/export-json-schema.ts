import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import Ajv from "ajv";
import packageJson from "../package.json" with { type: "json" };

// Runs BEFORE export-canonical-assets.ts. That script no longer wipes all of
// ./dist (only the subtrees it owns), so the artifacts written here survive
// the rest of the build.

const ajv = new Ajv();

const schemas = [
    ["activity-stream", "ActivityStreamSchema"],
    ["platform", "PlatformSchema"],
    ["sockethub-config", "SockethubConfigSchema"],
];

if (existsSync("./dist/schemas/json")) {
    rmSync("./dist/schemas/json", { recursive: true, force: true });
}

mkdirSync("./dist/schemas/json", { recursive: true });

for (const [fileName, objName] of schemas) {
    const s = await import(`../src/schemas/${fileName}.ts`);
    ajv.addSchema(s[objName]);
    const jsonSchema = JSON.stringify(s[objName], null, "\t");
    writeFileSync(
        `./dist/schemas/json/${fileName}.json`,
        jsonSchema.replace("/v/", `/${packageJson.version}/`),
    );
}
