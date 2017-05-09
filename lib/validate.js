/**
 * responsible for handling the validation of all incoming objects
 */
var init     = require('./bootstrap/init.js');

var tv4      = require('tv4'),
    nconf    = require('nconf'),
    Debug    = require('debug'),
    activity = require('activity-streams')(nconf.get('activity-streams:opts'));

var debug    = Debug('sockethub:validate');

module.exports = function (cfg) {
  var onfail = function (type, err) {
    throw new Error('validation failed for ' + type + ' and no onfail handler registered. ', err);
  };

  if ((cfg) && (typeof cfg.onfail === 'function')) {
    onfail = cfg.onfail;
  }

  //
  // called when registered with the middleware function, define the type of validation
  // that will be called when the middleware eventually does.
  //
  return function validate(type) {
    // called by the middleware with the message and the next (callback) in the chain
    return function (msg, next) {
      var err = '', stream;

      debug('validating ' + type);

      if ((typeof msg !== 'object') ||
          (Array.isArray(msg))) {
        err = 'message received is not an object.';
        onfail(err, type, msg);
        return next(false, err);
      }

      if (type === 'activity-object') {
        // activity objects get checked against the sockethub activity object schema
        var _schema = tv4.getSchema('http://sockethub.org/schemas/v0/activity-object#');
        if (! tv4.validate({ object:msg }, 'http://sockethub.org/schemas/v0/activity-object#')) {
          err = 'activity-object schema validation failed: ' + tv4.error.dataPath + ' = ' + tv4.error.message;
          onfail(err, type, msg);
          return next(false, err);
        }

      } else {
        if (typeof msg.context !== 'string') {
          err = 'message must contain a context property.';
          onfail(err, type, msg);
          return next(false, err);
        } else if (! init.platforms.exists(msg.context)) {
          err = 'platform context ' + msg.context + ' not registered with this sockethub instance.';
          onfail(err, type, msg);
          return next(false, err);
        } else if ((type === 'message') &&
                   (typeof msg['@type'] !== 'string')) {
          err = 'message must contain a @type property.';
          onfail(err, type, msg);
          return next(false, err);
        }

        if (type === 'credentials') {
          // expand actor and target properties if they are just strings
          if (typeof msg.actor === 'string') {
            msg.actor = activity.Object.get(msg.actor, true);
          }
          if (typeof msg.target === 'string') {
            msg.target = activity.Object.get(msg.target, true);
          }

          if (! tv4.getSchema('http://sockethub.org/schemas/v0/context/' + msg.context + '/credentials')) {
            err = 'no credentials schema found for ' + msg.context + ' context';
            onfail(err, type, msg);
            return next(false, err);
          } else if (! tv4.validate(msg, 'http://sockethub.org/schemas/v0/context/' + msg.context + '/credentials')) {
            err = 'credentials schema validation failed: ' + tv4.error.dataPath + ' = ' + tv4.error.message;
            onfail(err, type, msg);
            return next(false, err);
          }
        } else {
          try {
            // this expands the AS object to a full object with the expected properties,
            // or fails with something thats missing.
            stream = activity.Stream(msg);
          } catch (e) {
            onfail(e, type, msg);
            return next(false, e);
          }

          if (! tv4.validate(stream, 'http://sockethub.org/schemas/v0/activity-stream#')) {
            // TODO figure out a way to allow for special objects from platforms, without ignoring failed activity stream schema checks
            if (! tv4.getSchema('http://sockethub.org/schemas/v0/context/' + stream.context + '/messages')) {
              err = 'actvity-stream schema validation failed: ' + tv4.error.dataPath + ': ' + tv4.error.message;
              onfail(err, type, stream);
              return next(false, err);
            }
          }
        }
      }

      // passed validation
      next(true, stream);
    };
  };
};
