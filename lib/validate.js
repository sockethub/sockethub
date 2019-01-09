/**
 * responsible for handling the validation of all incoming objects
 */
const init     = require('./bootstrap/init'),
      tv4      = require('tv4'),
      nconf    = require('nconf'),
      Debug    = require('debug'),
      URI      = require('urijs'),
      activity = require('activity-streams')(nconf.get('activity-streams:opts')),
      debug    = Debug('sockethub:validate');

function getUriFragment(uri) {
  const frag = uri.fragment();
  return (frag) ? '#' + frag : undefined;
}

// educated guess on what the displayName is, if it's not defined
// since we know the @id is a URI, we prioritize by username, then fragment (no case yet for path)
function ensureDisplayName(msg) {
  let displayName = msg.displayName;
  if ((msg['@id']) && (! msg.displayName)) {
    const uri = new URI(msg['@id']);
    displayName = uri.username() || getUriFragment(uri) || uri.path();
  }
  return displayName;
}

function ensureObject(msg) {
  return !((typeof msg !== 'object') || (Array.isArray(msg)));
}

function validateActivityObject(msg) {
  return tv4.validate({ object: msg }, 'http://sockethub.org/schemas/v0/activity-object#');
}

function expandProp(propName, prop) {
  return (typeof prop === 'string') ? activity.Object.get(prop, true) : prop;
}

function validateCredentials(msg) {
  return tv4.validate(msg,
    `http://sockethub.org/schemas/v0/context/${msg.context}/credentials`);
}

function validateActivityStream(msg) {
  // TODO figure out a way to allow for special objects from platforms, without
  // ignoring failed activity stream schema checks
  if (! tv4.validate(msg, 'http://sockethub.org/schemas/v0/activity-stream#')) {
    return tv4.getSchema(`http://sockethub.org/schemas/v0/context/${msg.context}/messages`);
  }
  return true;
}

// called when registered with the middleware function, define the type of validation
// that will be called when the middleware eventually does.
//
module.exports = function validate(type) {
  // called by the middleware with the message and the next (callback) in the chain
  return (next, msg) => {
    debug('applying schema validation for ' + type);

    if (! ensureObject(msg)) {
      return next(false, `message received is not an object.`, type, msg);
    } else if (type === 'activity-object') {
      // activity objects get checked against the sockethub activity object schema
      if (! validateActivityObject(msg)) {
        return next(false,
          `activity-object schema validation failed: ${tv4.error.dataPath} = ${tv4.error.message}`,
          type, msg);
      }
      // msg.displayName = ensureDisplayName(msg);
      msg.displayName = ensureDisplayName(msg);
      // passed validation
      return next(true, msg);
    } else if (typeof msg.context !== 'string') {
      return next(false, 'message must contain a context property', type, msg);
    } else if (! init.platforms.has(msg.context)) {
      return next(false,
        `platform context ${msg.context} not registered with this sockethub instance.`, type, msg);
    } else if ((type === 'message') && (typeof msg['@type'] !== 'string')) {
      return next(false, 'message must contain a @type property.', type, msg);
    } else if (type === 'credentials') {
      // expand actor and target properties if they are just strings
      msg.actor = expandProp('actor', msg.actor);
      msg.target = expandProp('target', msg.target);

      if (! tv4.getSchema(`http://sockethub.org/schemas/v0/context/${msg.context}/credentials`)) {
        return next(false, `no credentials schema found for ${msg.context} context`, type, msg);
      }

      if (! validateCredentials(msg)) {
        return next(false,
          `credentials schema validation failed: ${tv4.error.dataPath} = ${tv4.error.message}`,
          type, msg);
      }
    } else {
      let stream;
      try {
        // this expands the AS object to a full object with the expected properties,
        // or fails with something that's missing.
        stream = activity.Stream(msg);
      } catch (e) {
        return next(false, e, type, msg);
      }
      // overwrite message with fully expanded as object stream
      msg = stream;

      if (! validateActivityStream(msg)) {
        return next(false,
          `actvity-stream schema validation failed: ${tv4.error.dataPath}: ${tv4.error.message}`,
          type, msg
        );
      }
    }

    msg.actor.displayName = ensureDisplayName(msg.actor);
    if (msg.target) {
      msg.target.displayName = ensureDisplayName(msg.target);
    }

    // passed validation
    return next(true, msg);
  };
};
