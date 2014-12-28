/**
 * responsible for handling the validation of all incoming objects
 */

var tv4      = require('tv4'),
    activity = require('activity-streams');

var init     = require('./bootstrap/init.js');


module.exports = function (cfg) {
  var onfail = function (type, err) {
    throw new Error('validation failed for ' + type + ' and no onfail handler registered. ', err);
  };

  if ((cfg) && (typeof cfg.onfail === 'function')) {
    onfail = cfg.onfail;
  }

  return function validate(type) {
    return function (msg, next) {

      if ((typeof msg !== 'object') ||
          (Array.isArray(msg))) {
        onfail('message received is not an object.', type, msg);
        return next(false);
      }

      if (type === 'activity-object') {

        if (! tv4.validate({object:msg}, 'http://sockethub.org/schemas/v0/activity-object#')) {
          onfail(tv4.error.dataPath + ': ' + tv4.error.message, type, msg);
          return next(false);
        }


      } else {

        if (typeof msg.platform !== 'string') {
          onfail('message must contain a platform property.', type, msg);
          return next(false);
        } else if (! init.platforms.exists(msg.platform)) {
          onfail('platform ' + msg.platform + ' not registered with this sockethub instance.', type, msg);
          return next(false);
        } else if ((type === 'message') &&
                   (typeof msg.verb !== 'string')) {
          onfail('message must contain a verb property.', type, msg);
          return next(false);
        }

        var stream = activity.Stream(msg);
        if (! tv4.validate(stream, 'http://sockethub.org/schemas/v0/activity-stream#')) {
          onfail(tv4.error.dataPath + ': ' + tv4.error.message, type, stream);
          return next(false);
        } else {
          if ((type === 'credentials') &&
              (! tv4.validate(stream, 'http://sockethub.org/schemas/v0/platforms/' + stream.platform + '/credentials'))) {
            onfail(tv4.error.dataPath + ': ' + tv4.error.message, type, stream);
            return next(false);
          } else if ((type === 'message') &&
                     (! tv4.validate(stream, 'http://sockethub.org/schemas/v0/platforms/' + stream.platform + '/messages'))) {
            onfail(tv4.error.dataPath + ': ' + tv4.error.message, type, stream);
            return next(false);
          }
        }

      }

      // passed validation
      next();
    };
  };
};
