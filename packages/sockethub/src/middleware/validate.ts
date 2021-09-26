/**
 * responsible for handling the validation and expansion (when applicable) of all incoming objects
 */
import Ajv from 'ajv';
import apply from 'ajv-formats-draft2019';
import debug from 'debug';
import * as SockethubSchemas from 'sockethub-schemas';
import { ActivityObject } from "../sockethub";

// @ts-ignore
import init from "../bootstrap/init";

export const ajv = new Ajv({strictTypes: false});
apply(ajv); // ajv-formats-draft2019

const schemaURL = 'https://sockethub.org/schemas/v0';
const log = debug('sockethub:validate');

log(`registering schema ${schemaURL}/activity-stream`);
ajv.addSchema(SockethubSchemas.ActivityStream, `${schemaURL}/activity-stream`);
log(`registering schema ${schemaURL}/activity-object`);
ajv.addSchema(SockethubSchemas.ActivityObject, `${schemaURL}/activity-object`);

init.platforms.forEach((platform) => {
  Object.keys(platform.schemas).forEach((key) => {
    if (! platform.schemas[key]) { return; }
    log(`registering schema ${schemaURL}/context/${platform.id}/${key}`);
    ajv.addSchema(platform.schemas[key], `${schemaURL}/context/${platform.id}/${key}`);
  });
});

function validateActivityObject(msg: any, done: Function) {
  const validate_activity_object = ajv.getSchema(
    `${schemaURL}/activity-object`);
  if (! validate_activity_object({ object: msg })) {
    done(new Error(
      `activity-object schema validation failed: ${validate_activity_object.errors[0].message}`));
  } else {
    done(msg);
  }
}

function validateActivityStream(msg: any, done: Function) {
  const validate_activity_stream = ajv.getSchema(`${schemaURL}/activity-stream`);
  if (! validate_activity_stream(msg)) {
    done(new Error(
      `actvity-stream schema validation failed: ${validate_activity_stream.errors[0].message}`));
  } else {
    done(msg);
  }
}

function validateCredentials(msg: any, done: Function) {
  if (msg.type !== 'credentials') {
    return done(new Error('credential activity streams must have credentials set as type'));
  }
  const validate_credentials = ajv.getSchema(
    `${schemaURL}/context/${msg.context}/credentials`);
  if (! validate_credentials(msg)) {
    done(new Error(
      `credentials schema validation failed: ${validate_credentials.errors[0].message}`));
  } else {
    done(msg);
  }
}


// called when registered with the middleware function, define the type of validation
// that will be called when the middleware eventually does.
export default function validate(type: string, sockethubId: string) {
  const sessionLog = debug(`sockethub:validate:${sockethubId}`);
  return (msg: ActivityObject, done: Function) => {
    sessionLog('applying schema validation for ' + type);
    if (type === 'activity-object') {
      validateActivityObject(msg, done);
    } else if (! init.platforms.has(msg.context)) {
      return done(
        new Error(`platform context ${msg.context} not registered with this sockethub instance.`)
      );
    } else if (type === 'credentials') {
      validateCredentials(msg, done);
    } else {
      validateActivityStream(msg, done);
    }
  };
};
