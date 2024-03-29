#!/usr/bin/env node
/* eslint-disable  @typescript-eslint/no-var-requires */
const Ajv = require("ajv");
const fs = require("fs");

const ajv = new Ajv();

const schemas = ["activity-stream", "activity-object", "platform"];

fs.mkdirSync("./dist/schemas/json");

for (let fileName of schemas) {
    // eslint-disable-next-line security/detect-non-literal-require
    const schema = require(`../dist/schemas/${fileName}`).default;
    ajv.addSchema(schema, schema.id);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const fd = fs.openSync(`./dist/schemas/json/${fileName}.json`, "w+");
    fs.writeSync(fd, JSON.stringify(schema, null, "\t"));
}
