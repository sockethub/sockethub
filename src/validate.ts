/**
 * responsible for handling the validation and expansion (when applicable) of all incoming objects
 */
import tv4 from 'tv4';
import debug from 'debug';
import URI from 'urijs';
import ActivityStreams from 'activity-streams';
import * as SockethubSchemas from 'sockethub-schemas';

import init from './bootstrap/init';
import config from './config';

const activity = ActivityStreams(config.get('activity-streams:opts')),
      log = debug('sockethub:validate');

// load sockethub-activity-stream schema and register it with tv4
// http://sockethub.org/schemas/v0/activity-stream#
tv4.addSchema(SockethubSchemas.ActivityStream.id, SockethubSchemas.ActivityStream);
// load sockethub-activity-object schema and register it with tv4
// http://sockethub.org/schemas/v0/activity-object#
tv4.addSchema(SockethubSchemas.ActivityObject.id, SockethubSchemas.ActivityObject);

// educated guess on what the displayName is, if it's not defined
// since we know the @id is a URI, we prioritize by username, then fragment (no case yet for path)
function ensureDisplayName(msg) {
  if ((msg['@id']) && (! msg.displayName)) {
    const uri = new URI(msg['@id']);
    return uri.username() || getUriFragment(uri) || uri.path();
  }
  return msg.displayName;
}

function ensureObject(msg) {
  return !((typeof msg !== 'object') || (Array.isArray(msg)));
}

function errorHandler(type, msg, next) {
  return (err) => {
    return next(false, err, type, msg);
  };
}

// expand given prop to full object if they are just strings
function expandProp(propName, prop) {
  return (typeof prop === 'string') ? activity.Object.get(prop, true) : prop;
}

function expandStream(msg) {
  msg.actor.displayName = ensureDisplayName(msg.actor);
  if (msg.target) {
    msg.target.displayName = ensureDisplayName(msg.target);
  }
  return msg;
}

function getUriFragment(uri) {
  const frag = uri.fragment();
  return (frag) ? '#' + frag : undefined;
}

function processActivityObject(msg, error, next) {
  if (! validateActivityObject(msg)) {
    return error(
      `activity-object schema validation failed: ${tv4.error.dataPath} = ${tv4.error.message}`
    );
  }
  msg.displayName = ensureDisplayName(msg);
  return next(true, msg); // passed validation, on to next handler in middleware chain
}

function processActivityStream(msg, error, next) {
  let stream;
  try { // expands the AS object to a full object with the expected properties
    stream = activity.Stream(msg);
  } catch (e) {
    return error(e);
  }
  msg = stream; // overwrite message with expanded as object stream

  if (! validateActivityStream(msg)) {
    return error(
      `actvity-stream schema validation failed: ${tv4.error.dataPath}: ${tv4.error.message}`);
  }
  // passed validation, on to next handler in middleware chain
  return next(true, expandStream(msg));
}

function processCredentials(msg, error, next) {
  msg.actor = expandProp('actor', msg.actor);
  msg.target = expandProp('target', msg.target);
  let credentialsSchema = tv4.getSchema(`http://sockethub.org/schemas/v0/context/${msg.context}/credentials`);
  if (! credentialsSchema) {
    return error(`no credentials schema found for ${msg.context} context`);
  }

  if (! validateCredentials(msg, credentialsSchema)) {
    return error(
      `credentials schema validation failed: ${tv4.error.dataPath} = ${tv4.error.message}`);
  }
  // passed validation, on to next handler in middleware chain
  return next(true, expandStream(msg));
}

function validateActivityObject(msg) {
  return tv4.validate({ object: msg }, SockethubSchemas.ActivityObject);
}

function validateCredentials(msg, schema) {
  return tv4.validate(msg, schema);
}

function validateActivityStream(msg) {
  // TODO figure out a way to allow for special objects from platforms, without
  // ignoring failed activity stream schema checks
  if (! tv4.validate(msg, SockethubSchemas.ActivityStream)) {
    return tv4.getSchema(`http://sockethub.org/schemas/v0/context/${msg.context}/messages`);
  }
  return true;
}

// called when registered with the middleware function, define the type of validation
// that will be called when the middleware eventually does.
export default function validate(type) {
  // called by the middleware with the message and the next (callback) in the chain
  return (next, msg) => {
    log('applying schema validation for ' + type);
    const error = errorHandler(type, msg, next);

    if (! ensureObject(msg)) {
      error(`message received is not an object.`);
    } else if (type === 'activity-object') {
      processActivityObject(msg, error, next);
    } else if (typeof msg.context !== 'string') {
      error('message must contain a context property');
    } else if (! init.platforms.has(msg.context)) {
      error(`platform context ${msg.context} not registered with this sockethub instance.`);
    } else if ((type === 'message') && (typeof msg['@type'] !== 'string')) {
      error('message must contain a @type property.');
    } else if (type === 'credentials') {
      processCredentials(msg, error, next);
    } else {
      processActivityStream(msg, error, next);
    }
  };
};
