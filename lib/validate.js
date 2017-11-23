/**
 * responsible for handling the validation of all incoming objects
 */
let init     = require("./bootstrap/init.js");

let tv4      = require("tv4"),
    nconf    = require("nconf"),
    Debug    = require("debug"),
    URI    = require("urijs"),
    activity = require("activity-streams")(nconf.get("activity-streams:opts"));

let debug    = Debug("sockethub:validate");

// educated guess on what the displayName is, if it's not defined
// since we know the @id is a URI, we prioritize by username, then fragment (no case yet for path)
function ensureDisplayName(obj) {
  if ((obj["@id"]) && (! obj.displayName)) {
    uri = new URI(obj["@id"]);
    obj.displayName = uri.username();
    if ((! obj.displayName) && (uri.fragment())) {
      obj.displayName = "#" + uri.fragment();
    }
    if (! obj.displayName) {
      obj.displayName = uri.path();
    }
  }
  return obj;
}

module.exports = function (cfg) {
  let onfail = function (type, err) {
    throw new Error("validation failed for " + type + " and no onfail handler registered. ", err);
  };

  if ((cfg) && (typeof cfg.onfail === "function")) {
    onfail = cfg.onfail;
  }

  //
  // called when registered with the middleware function, define the type of validation
  // that will be called when the middleware eventually does.
  //
  return function validate(type) {
    // called by the middleware with the message and the next (callback) in the chain
    return function (msg, next) {
      let err = "", stream;

      debug("validating " + type);

      if ((typeof msg !== "object") ||
          (Array.isArray(msg))) {
        err = "message received is not an object.";
        onfail(err, type, msg);
        return next(false, err);
      }

      if (type === "activity-object") {
        // activity objects get checked against the sockethub activity object schema
        let _schema = tv4.getSchema("http://sockethub.org/schemas/v0/activity-object#");
        if (! tv4.validate({ object:msg }, "http://sockethub.org/schemas/v0/activity-object#")) {
          err = "activity-object schema validation failed: " + tv4.error.dataPath + " = " + tv4.error.message;
          onfail(err, type, msg);
          return next(false, err);
        }
        msg = ensureDisplayName(msg);
      } else {

        if (typeof msg.context !== "string") {
          err = "message must contain a context property.";
          onfail(err, type, msg);
          return next(false, err);
        } else if (! init.platforms.exists(msg.context)) {
          err = "platform context " + msg.context + " not registered with this sockethub instance.";
          onfail(err, type, msg);
          return next(false, err);
        } else if ((type === "message") &&
                   (typeof msg["@type"] !== "string")) {
          err = "message must contain a @type property.";
          onfail(err, type, msg);
          return next(false, err);
        }

        if (type === "credentials") {
          // expand actor and target properties if they are just strings
          if (typeof msg.actor === "string") {
            msg.actor = activity.Object.get(msg.actor, true);
          }
          if (typeof msg.target === "string") {
            msg.target = activity.Object.get(msg.target, true);
          }

          if (! tv4.getSchema("http://sockethub.org/schemas/v0/context/" + msg.context + "/credentials")) {
            err = "no credentials schema found for " + msg.context + " context";
            onfail(err, type, msg);
            return next(false, err);
          } else if (! tv4.validate(msg, "http://sockethub.org/schemas/v0/context/" + msg.context + "/credentials")) {
            err = "credentials schema validation failed: " + tv4.error.dataPath + " = " + tv4.error.message;
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
          msg = stream;

          if (! tv4.validate(msg, "http://sockethub.org/schemas/v0/activity-stream#")) {
            // TODO figure out a way to allow for special objects from platforms, without ignoring failed activity stream schema checks
            if (! tv4.getSchema("http://sockethub.org/schemas/v0/context/" + msg.context + "/messages")) {
              err = "actvity-stream schema validation failed: " + tv4.error.dataPath + ": " + tv4.error.message;
              onfail(err, type, msg);
              return next(false, err);
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
};
