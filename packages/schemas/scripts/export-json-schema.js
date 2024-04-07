#!/usr/bin/env node --experimental-specifier-resolution=node
import Ajv from "ajv";
import fs from "fs";

const ajv = new Ajv();

const schemas = [
    ["activity-stream", "ActivityStreamSchema"],
    ["activity-object", "ActivityObjectSchema"],
    ["platform", "PlatformSchema"],
];

fs.mkdirSync("./dist/schemas/json");

for (let [fileName, objName] of schemas) {
    import(`../dist/schemas/${fileName}.js`).then((module) => {
        ajv.addSchema(module[objName]);
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const fd = fs.openSync(`./dist/schemas/json/${fileName}.json`, "w+");
        fs.writeSync(fd, JSON.stringify(module[objName], null, "\t"));
    });
}
