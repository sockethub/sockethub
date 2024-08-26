#!/usr/bin/env node
import Ajv from 'ajv';
import fs from 'node:fs';

import ActivityObject from "../src/schemas/activity-object.ts";
import ActivityStream from "../src/schemas/activity-stream.ts";
import Platform from "../src/schemas/platform.ts";

const ajv = new Ajv();

const jsonDir = "./src/schemas/json"

if (!fs.existsSync(jsonDir)) {
    fs.mkdirSync(jsonDir);
}

for (const [fileName, schema] of [["activity-object", ActivityObject], ["activity-stream", ActivityStream], ["platform", Platform]]) {
    // eslint-disable-next-line security/detect-non-literal-require
    ajv.addSchema(schema, schema.id);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const fd = fs.openSync(`./src/schemas/json/${fileName}.json`, "w+");
    fs.writeSync(fd, JSON.stringify(schema, null, "\t"));
}
