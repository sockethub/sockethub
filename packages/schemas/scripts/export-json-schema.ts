#!/usr/bin/env node
import Ajv, { AnySchema } from 'npm:ajv';
import fs from 'node:fs';

import ActivityObject from "../src/schemas/activity-object.ts";
import ActivityStream from "../src/schemas/activity-stream.ts";
import Platform from "../src/schemas/platform.ts";

const ajv = new Ajv.default();

const jsonDir = "./src/schemas/"

for (const [fileName, schema] of [["activity-object", ActivityObject], ["activity-stream", ActivityStream], ["platform", Platform]]) {
    ajv.addSchema(schema as AnySchema, schema.id);
    const fd = fs.openSync(`${jsonDir}${fileName}.json`, "w+");
    fs.writeSync(fd, JSON.stringify(schema, null, "\t"));
}
