/**
 * responsible for handling the validation and expansion (when applicable) of all incoming objects
 */
import tv4 from 'tv4';
import debug from 'debug';
import * as SockethubSchemas from 'sockethub-schemas';

import {ActivityObject} from "../sockethub";

// load sockethub-activity-stream schema and register it with tv4
// http://sockethub.org/schemas/v0/activity-stream#
tv4.addSchema(SockethubSchemas.ActivityStream.id, SockethubSchemas.ActivityStream);
// load sockethub-activity-object schema and register it with tv4
// http://sockethub.org/schemas/v0/activity-object#
tv4.addSchema(SockethubSchemas.ActivityObject.id, SockethubSchemas.ActivityObject);

// educated guess on what the displayName is, if it's not defined
// since we know the @id is a URI, we prioritize by username, then fragment (no case yet for path)
// function ensureDisplayName(msg: any) {
//   if ((msg['@id']) && (! msg.displayName)) {
//     const uri = new URI(msg['@id']);
//     return uri.username() || getUriFragment(uri) || uri.path();
//   }
//   return msg.displayName;
// }

// function ensureObject(msg: any) {
//   return !((typeof msg !== 'object') || (Array.isArray(msg)));
// }
//
// // expand given prop to full object if they are just strings
// // FIXME are we sure this works? What's propName for?
// function expandProp(propName, prop) {
//   return (typeof prop === 'string') ? activity.Object.get(prop, true) : prop;
// }


// function getUriFragment(uri: any) {
//   const frag = uri.fragment();
//   return (frag) ? '#' + frag : undefined;
// }

function processActivityObject(msg: any, done: Function) {
  if (! validateActivityObject(msg)) {
    return done(new Error(
      `activity-object schema validation failed: ${tv4.error.dataPath} = ${tv4.error.message}`));
  }
  // msg.displayName = ensureDisplayName(msg);
  return done(msg); // passed validation, on to next handler in middleware chain
}

function processActivityStream(msg: any, done: Function) {
  // let stream;
  // try { // expands the AS object to a full object with the expected properties
  //   stream = activity.Stream(msg);
  // } catch (e) {
  //   return done(new Error(e));
  // }
  // msg = stream; // overwrite message with expanded as object stream

  if (! validateActivityStream(msg)) {
    return done(new Error(
      `actvity-stream schema validation failed: ${tv4.error.dataPath}: ${tv4.error.message}`));
  }
  // passed validation, on to next handler in middleware chain
  return done(msg);
}

function processCredentials(msg: any, done: Function) {
  let credentialsSchema = tv4.getSchema(
    `http://sockethub.org/schemas/v0/context/${msg.context}/credentials`);
  if (! credentialsSchema) {
    return done(new Error(`no credentials schema found for ${msg.context} context`));
  }

  if (! validateCredentials(msg, credentialsSchema)) {
    return done(new Error(
      `credentials schema validation failed: ${tv4.error.dataPath} = ${tv4.error.message}`));
  }
  // passed validation, on to next handler in middleware chain
  return done(msg);
}

function validateActivityObject(msg: any) {
  return tv4.validate({ object: msg }, SockethubSchemas.ActivityObject);
}

function validateCredentials(msg: any, schema: any) {
  return tv4.validate(msg, schema);
}

function validateActivityStream(msg: any) {
  // TODO figure out a way to allow for special objects from platforms, without
  // ignoring failed activity stream schema checks
  if (! tv4.validate(msg, SockethubSchemas.ActivityStream)) {
    return tv4.getSchema(`http://sockethub.org/schemas/v0/context/${msg.context}/messages`);
  }
  return true;
}

// called when registered with the middleware function, define the type of validation
// that will be called when the middleware eventually does.
export default function validate(type: string, sockethubId: string) {
  const sessionLog = debug(`sockethub:validate:${sockethubId}`);
  // called by the middleware with the message and the next (callback) in the chain
  return (msg: ActivityObject, done: Function) => {
    sessionLog('applying schema validation for ' + type);
    if (type === 'activity-object') {
      processActivityObject(msg, done);
    } else if (type === 'credentials') {
      processCredentials(msg, done);
    } else {
      processActivityStream(msg, done);
    }
  };
};