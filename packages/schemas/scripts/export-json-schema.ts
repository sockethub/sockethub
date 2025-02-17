import { existsSync, mkdirSync, openSync, rmdirSync, writeSync } from "node:fs";
import Ajv from "ajv";

const ajv = new Ajv();

const schemas = [
    ["activity-stream", "ActivityStreamSchema"],
    ["activity-object", "ActivityObjectSchema"],
    ["platform", "PlatformSchema"],
];

if (existsSync("./src/schemas/json")) {
    rmdirSync("./src/schemas/json", { recursive: true });
}

mkdirSync("./src/schemas/json");

for (const [fileName, objName] of schemas) {
    import(`../src/schemas/${fileName}.ts`).then((module) => {
        ajv.addSchema(module[objName]);
        const fd = openSync(`./src/schemas/json/${fileName}.json`, "w+");
        writeSync(fd, JSON.stringify(module[objName], null, "\t"));
    });
}
