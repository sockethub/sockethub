/**
 * responsible for handling the validation of all incoming objects
 */
const init     = require('./bootstrap/init');

const tv4      = require('tv4'),
      nconf    = require('nconf'),
      Debug    = require('debug'),
      URI      = require('urijs'),
      activity = require('activity-streams')(nconf.get('activity-streams:opts'));

const debug    = Debug('sockethub:validate');

// educated guess on what the displayName is, if it's not defined
// since we know the @id is a URI, we prioritize by username, then fragment (no case yet for path)
function ensureDisplayName(obj) {
  if ((obj['@id']) && (! obj.displayName)) {
    uri = new URI(obj['@id']);
    obj.displayName = uri.username();
    if ((! obj.displayName) && (uri.fragment())) {
      obj.displayName = '#' + uri.fragment();
    }
    if (! obj.displayName) {
      obj.displayName = uri.path();
    }
  }
  return obj;
}

// called when registered with the middleware function, define the type of validation
// that will be called when the middleware eventually does.
//
module.exports = function validate(type) {
  // called by the middleware with the message and the next (callback) in the chain
  return (next, msg)  => {
    let err = '', stream;

    debug('applying schema validation for ' + type);

    if ((typeof msg !== 'object') ||
        (Array.isArray(msg))) {
      err = 'message received is not an object.';
      return next(false, err, type, msg);
    }

    if (type === 'activity-object') {
      // activity objects get checked against the sockethub activity object schema
      const _schema = tv4.getSchema('http://sockethub.org/schemas/v0/activity-object#');
      if (! tv4.validate({ object:msg }, 'http://sockethub.org/schemas/v0/activity-object#')) {
        err = 'activity-object schema validation failed: ' + tv4.error.dataPath + ' = '
              + tv4.error.message;
        return next(false, err, type, msg);
      }
      msg = ensureDisplayName(msg);
    } else {

      if (typeof msg.context !== 'string') {
        err = 'message must contain a context property.';
        return next(false, err, type, msg);
      } else if (! init.platforms.has(msg.context)) {
        err = 'platform context ' + msg.context
              + ' not registered with this sockethub instance.';
        return next(false, err, type, msg);
      } else if ((type === 'message') && (typeof msg['@type'] !== 'string')) {
        err = 'message must contain a @type property.';
        return next(false, err, type, msg);
      }

      if (type === 'credentials') {
        // expand actor and target properties if they are just strings
        if (typeof msg.actor === 'string') {
          msg.actor = activity.Object.get(msg.actor, true);
        }
        if (typeof msg.target === 'string') {
          msg.target = activity.Object.get(msg.target, true);
        }

        if (! tv4.getSchema('http://sockethub.org/schemas/v0/context/' + msg.context
                            + '/credentials')) {
          err = 'no credentials schema found for ' + msg.context + ' context';
          return next(false, err, type, msg);
        } else if (! tv4.validate(msg, 'http://sockethub.org/schemas/v0/context/'
                                  + msg.context + '/credentials')) {
          err = 'credentials schema validation failed: ' + tv4.error.dataPath + ' = '
                + tv4.error.message;
          return next(false, err, type, msg);
        }
      } else {
        try {
          // this expands the AS object to a full object with the expected properties,
          // or fails with something thats missing.
          stream = activity.Stream(msg);
        } catch (e) {
          return next(false, e, type, msg);
        }
        msg = stream;

        if (! tv4.validate(msg, 'http://sockethub.org/schemas/v0/activity-stream#')) {
          // TODO figure out a way to allow for special objects from platforms, without
          // ignoring failed activity stream schema checks
          if (! tv4.getSchema('http://sockethub.org/schemas/v0/context/' + msg.context
                              + '/messages')) {
            err = 'actvity-stream schema validation failed: ' + tv4.error.dataPath + ': '
                  + tv4.error.message;
            return next(false, err, type, msg);
          }
        }
      }

      msg.actor = ensureDisplayName(msg.actor);
      if (msg.target) {
        msg.target = ensureDisplayName(msg.target);
      }
    }

    // passed validation
    next(true, msg);
  };
};
