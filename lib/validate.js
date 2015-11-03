/**
 * responsible for handling the validation of all incoming objects
 */
var init     = require('./bootstrap/init.js');

var tv4      = require('tv4'),
    nconf    = require('nconf'),
    activity = require('activity-streams')(nconf.get('activity-streams:opts'));

module.exports = function (cfg) {
  var onfail = function (type, err) {
    throw new Error('validation failed for ' + type + ' and no onfail handler registered. ', err);
  };

  if ((cfg) && (typeof cfg.onfail === 'function')) {
    onfail = cfg.onfail;
  }

  return function validate(type) {
    return function (msg, next) {
      var err = '';

      if ((typeof msg !== 'object') ||
          (Array.isArray(msg))) {
        err = 'message received is not an object.';
        onfail(err, type, msg);
        return next(false, err);
      }

      if (type === 'activity-object') {
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
          err = 'context ' + msg.context+ ' not registered with this sockethub instance.';
          onfail(err, type, msg);
          return next(false, err);
        } else if ((type === 'message') &&
                   (typeof msg['@type'] !== 'string')) {
          err = 'message must contain a @type property.';
          onfail(err, type, msg);
          return next(false, err);
        }

        var stream = activity.Stream(msg);
        if (type === 'credentials') {

          if (! tv4.getSchema('http://sockethub.org/schemas/v0/context/' + stream.context + '/credentials')) {
            err = 'no credentials schema found for ' + stream.context + ' context';
            onfail(err, type, stream);
            return next(false, err);
          } else if (! tv4.validate(stream, 'http://sockethub.org/schemas/v0/context/' + stream.context + '/credentials')) {
            err = 'credentials schema validation failed: ' + tv4.error.dataPath + ' = ' + tv4.error.message;
            onfail(err, type, stream);
            return next(false, err);
          }

        } else {

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
      next();
    };
  };
};
