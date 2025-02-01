#!/usr/bin/env node
// --experimental-specifier-resolution=node
import Ajv from "ajv";
import {writeSync, openSync, mkdirSync} from "fs";

const ajv = new Ajv();

const schemas = [
    ["activity-stream", "ActivityStreamSchema"],
    ["activity-object", "ActivityObjectSchema"],
    ["platform", "PlatformSchema"],
];

mkdirSync("./src/schemas/json");

for (const [fileName, objName] of schemas) {
    import(`../rc/schemas/${fileName}.ts`).then((module) => {
        ajv.addSchema(module[objName]);
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const fd = openSync(`./src/schemas/json/${fileName}.json`, "w+");
        writeSync(fd, JSON.stringify(module[objName], null, "\t"));
    });
}
