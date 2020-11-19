"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * responsible for handling the validation and expansion (when applicable) of all incoming objects
 */
const tv4_1 = __importDefault(require("tv4"));
const debug_1 = __importDefault(require("debug"));
const urijs_1 = __importDefault(require("urijs"));
const activity_streams_1 = __importDefault(require("activity-streams"));
const SockethubSchemas = __importStar(require("sockethub-schemas"));
const init_1 = __importDefault(require("./bootstrap/init"));
const config_1 = __importDefault(require("./config"));
const activity = activity_streams_1.default(config_1.default.get('activity-streams:opts')), log = debug_1.default('sockethub:validate');
// load sockethub-activity-stream schema and register it with tv4
// http://sockethub.org/schemas/v0/activity-stream#
tv4_1.default.addSchema(SockethubSchemas.ActivityStream.id, SockethubSchemas.ActivityStream);
// load sockethub-activity-object schema and register it with tv4
// http://sockethub.org/schemas/v0/activity-object#
tv4_1.default.addSchema(SockethubSchemas.ActivityObject.id, SockethubSchemas.ActivityObject);
// educated guess on what the displayName is, if it's not defined
// since we know the @id is a URI, we prioritize by username, then fragment (no case yet for path)
function ensureDisplayName(msg) {
    if ((msg['@id']) && (!msg.displayName)) {
        const uri = new urijs_1.default(msg['@id']);
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
// FIXME are we sure this works? What's propName for?
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
    if (!validateActivityObject(msg)) {
        return error(`activity-object schema validation failed: ${tv4_1.default.error.dataPath} = ${tv4_1.default.error.message}`);
    }
    msg.displayName = ensureDisplayName(msg);
    return next(true, msg); // passed validation, on to next handler in middleware chain
}
function processActivityStream(msg, error, next) {
    let stream;
    try { // expands the AS object to a full object with the expected properties
        stream = activity.Stream(msg);
    }
    catch (e) {
        return error(e);
    }
    msg = stream; // overwrite message with expanded as object stream
    if (!validateActivityStream(msg)) {
        return error(`actvity-stream schema validation failed: ${tv4_1.default.error.dataPath}: ${tv4_1.default.error.message}`);
    }
    // passed validation, on to next handler in middleware chain
    return next(true, expandStream(msg));
}
function processCredentials(msg, error, next) {
    msg.actor = expandProp('actor', msg.actor);
    msg.target = expandProp('target', msg.target);
    let credentialsSchema = tv4_1.default.getSchema(`http://sockethub.org/schemas/v0/context/${msg.context}/credentials`);
    if (!credentialsSchema) {
        return error(`no credentials schema found for ${msg.context} context`);
    }
    if (!validateCredentials(msg, credentialsSchema)) {
        return error(`credentials schema validation failed: ${tv4_1.default.error.dataPath} = ${tv4_1.default.error.message}`);
    }
    // passed validation, on to next handler in middleware chain
    return next(true, expandStream(msg));
}
function validateActivityObject(msg) {
    return tv4_1.default.validate({ object: msg }, SockethubSchemas.ActivityObject);
}
function validateCredentials(msg, schema) {
    return tv4_1.default.validate(msg, schema);
}
function validateActivityStream(msg) {
    // TODO figure out a way to allow for special objects from platforms, without
    // ignoring failed activity stream schema checks
    if (!tv4_1.default.validate(msg, SockethubSchemas.ActivityStream)) {
        return tv4_1.default.getSchema(`http://sockethub.org/schemas/v0/context/${msg.context}/messages`);
    }
    return true;
}
// called when registered with the middleware function, define the type of validation
// that will be called when the middleware eventually does.
function validate(type) {
    // called by the middleware with the message and the next (callback) in the chain
    return (next, msg) => {
        log('applying schema validation for ' + type);
        const error = errorHandler(type, msg, next);
        if (!ensureObject(msg)) {
            error(`message received is not an object.`);
        }
        else if (type === 'activity-object') {
            processActivityObject(msg, error, next);
        }
        else if (typeof msg.context !== 'string') {
            error('message must contain a context property');
        }
        else if (!init_1.default.platforms.has(msg.context)) {
            error(`platform context ${msg.context} not registered with this sockethub instance.`);
        }
        else if ((type === 'message') && (typeof msg['@type'] !== 'string')) {
            error('message must contain a @type property.');
        }
        else if (type === 'credentials') {
            processCredentials(msg, error, next);
        }
        else {
            processActivityStream(msg, error, next);
        }
    };
}
exports.default = validate;
;
//# sourceMappingURL=validate.js.map