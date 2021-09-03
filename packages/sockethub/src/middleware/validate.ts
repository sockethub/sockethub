/**
 * responsible for handling the validation and expansion (when applicable) of all incoming objects
 */
import tv4 from 'tv4';
import debug from 'debug';
import * as SockethubSchemas from 'sockethub-schemas';
import { ActivityObject } from "../sockethub";

// @ts-ignore
import platformLoad from './../bootstrap/platforms';
import init from "../bootstrap/init";
const packageJSON = require('./../../package.json');
const platforms = platformLoad(Object.keys(packageJSON.dependencies));

// load sockethub-activity-stream schema and register it with tv4
// http://sockethub.org/schemas/v0/activity-stream#
tv4.addSchema(SockethubSchemas.ActivityStream.id, SockethubSchemas.ActivityStream);
// load sockethub-activity-object schema and register it with tv4
// http://sockethub.org/schemas/v0/activity-object#
tv4.addSchema(SockethubSchemas.ActivityObject.id, SockethubSchemas.ActivityObject);


function validateActivityObject(msg: any, done: Function) {
  if (! tv4.validate({ object: msg }, SockethubSchemas.ActivityObject)) {
    return done(new Error(
      `activity-object schema validation failed: ${tv4.error.dataPath} = ${tv4.error.message}`));
  }
  return done(msg);
}

function validateActivityStream(msg: any, done: Function) {
  // tv4.getSchema(`http://sockethub.org/schemas/v0/context/${msg.context}/messages`)
  if (! tv4.validate(msg, SockethubSchemas.ActivityStream)) {
    return done(new Error(
      `actvity-stream schema validation failed: ${tv4.error.dataPath}: ${tv4.error.message}`));
  }
  return done(msg);
}

function validateCredentials(msg: any, done: Function) {
  if (msg['@type'] !== 'credentials') {
    return done(new Error('credential activity streams must have credentials set as @type'));
  }
  let credentialsSchema = tv4.getSchema(
    `http://sockethub.org/schemas/v0/context/${msg.context}/credentials`);
  if (! credentialsSchema) {
    return done(new Error(`no credentials schema found for ${msg.context} context`));
  } else if (! tv4.validate(msg, credentialsSchema)) {
    return done(new Error(
      `credentials schema validation failed: ${tv4.error.dataPath} = ${tv4.error.message}`));
  } else {
    return done(msg);
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