import { existsSync, mkdirSync, openSync, rmSync, writeSync } from "node:fs";
import Ajv from "ajv";
import packageJson from "../package.json" with { type: "json" };

const ajv = new Ajv();

const schemas = [
    ["activity-stream", "ActivityStreamSchema"],
    ["activity-object", "ActivityObjectSchema"],
    ["platform", "PlatformSchema"],
    ["sockethub-config", "SockethubConfigSchema"],
];

if (existsSync("./src/schemas/json")) {
    rmSync("./src/schemas/json", { recursive: true, force: true });
}

mkdirSync("./src/schemas/json");

for (const [fileName, objName] of schemas) {
    import(`../src/schemas/${fileName}.ts`).then((s) => {
        ajv.addSchema(s[objName]);
        const fd = openSync(`./src/schemas/json/${fileName}.json`, "w+");
        const jsonSchema = JSON.stringify(s[objName], null, "\t");
        writeSync(fd, jsonSchema.replace("/v/", `/${packageJson.version}/`));
    });
}
