import debug from 'debug';
import Ajv, {Schema} from 'ajv';
import ajvFormat2019 from 'ajv-formats-draft2019';
import getErrorMessage from "./helpers/error-parser";
import {IActivityStream} from "./types";
import PlatformSchema from './schemas/platform';
import ActivityStreamsSchema from './schemas/activity-stream';
import ActivityObjectSchema from './schemas/activity-object';
const log = debug('sockethub:schemas');
const ajv = new Ajv({strictTypes: false, allErrors: true});
ajvFormat2019(ajv);

interface SchemasDict {
  string?: Schema
}

const schemaURL = 'https://sockethub.org/schemas/v0';
const schemas: SchemasDict = {};

schemas[`${schemaURL}/activity-stream`] = ActivityStreamsSchema;
schemas[`${schemaURL}/activity-object`] = ActivityObjectSchema;

for (let uri in schemas) {
  log(`registering schema ${uri}`);
  ajv.addSchema(schemas[uri], uri);
}

function handleValidation(schemaRef: string, msg: IActivityStream, isObject=false): string {
  const validator = ajv.getSchema(schemaRef);
  let result: boolean | Promise<unknown>;
  if (isObject) {
    result = validator({ object: msg });
  } else {
    result = validator(msg);
  }
  if (! result) {
    return getErrorMessage(msg, validator.errors);
  }
  return "";
}

export function validateActivityObject(msg: IActivityStream): string {
  return handleValidation(`${schemaURL}/activity-object`, msg, true);
}

export function validateActivityStream(msg: IActivityStream): string {
  return handleValidation(`${schemaURL}/activity-stream`, msg);
}

export function validateCredentials(msg: IActivityStream): string {
  if (!msg.context) {
    return 'credential activity streams must have a context set';
  }
  if (msg.type !== 'credentials') {
    return 'credential activity streams must have credentials set as type';
  }
  return handleValidation(`${schemaURL}/context/${msg.context}/credentials`, msg);
}

export function validatePlatformSchema(schema: Schema): string {
  const validate = ajv.compile(PlatformSchema);
  // validate schema property
  const err = validate(schema);
  if (! err) {
    return `platform schema failed to validate: ` +
      `${validate.errors[0].instancePath} ${validate.errors[0].message}`;
  } else {
    return "";
  }
}

export function addPlatformSchema(schema: Schema, platform_type: string) {
  log(`registering schema ${schemaURL}/context/${platform_type}`);
  ajv.addSchema(schema, `${schemaURL}/context/${platform_type}`);
}
