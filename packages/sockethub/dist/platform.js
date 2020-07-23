"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
const object_hash_1 = __importDefault(require("object-hash"));
const services_1 = __importDefault(require("./services"));
const crypto_1 = __importDefault(require("./crypto"));
const common_1 = require("./common");
// command-line params
const parentId = process.argv[2];
const platformName = process.argv[3];
const identifier = process.argv[4];
const logger = debug_1.default('sockethub:platform');
logger(`platform handler initialized for ${platformName} ${identifier}`);
const PlatformModule = require(`sockethub-platform-${platformName}`);
let parentSecret1, parentSecret2;
/**
 * Handle any uncaught errors from the platform by alerting the worker and shutting down.
 */
process.on('uncaughtException', (err) => {
    console.log(`\nUNCAUGHT EXCEPTION IN PLATFORM\n`);
    console.log(err.stack);
    process.send(['error', err.toString()]);
    process.exit(1);
});
/**
 * Incoming messages from the worker to this platform. Data is an array, the first property is the
 * method to call, the rest are params.
 */
process.on('message', (msg) => {
    // console.log('incoming IPC message: ' + msg.type, msg.data);
    if (msg.type === 'secrets') {
        parentSecret1 = msg.data.parentSecret1;
        parentSecret2 = msg.data.parentSecret2;
        startQueueListener();
    }
});
/**
 * sendFunction wrapper, generates a function to pass to the platform class. The platform can
 * call that function to send messages back to the client.
 * @param command
 */
function sendFunction(command) {
    return function (msg) {
        logger('sending to client');
        process.send([command, msg]);
    };
}
/**
 * Initialize platform module
 */
const platform = new PlatformModule({
    debug: debug_1.default(`sockethub:platform:${platformName}:${identifier}`),
    sendToClient: sendFunction('message'),
    updateCredentials: sendFunction('updateCredentials')
});
/**
 * get the credentials stored for this user in this sessions store, if given the correct
 * sessionSecret.
 * @param actorId
 * @param sessionId
 * @param sessionSecret
 * @param cb
 */
function getCredentials(actorId, sessionId, sessionSecret, cb) {
    const store = common_1.getSessionStore(parentId, parentSecret1, sessionId, sessionSecret);
    store.get(actorId, (err, credentials) => {
        if (platform.config.persist) {
            // don't continue if we don't get credentials
            if (err) {
                return cb(err);
            }
        }
        if (platform.credentialsHash) {
            if (platform.credentialsHash !== object_hash_1.default(credentials.object)) {
                return cb('provided credentials do not match existing platform instance for actor '
                    + platform.actor['@id']);
            }
        }
        else {
            console.log('hashing credentials object ', credentials);
            platform.credentialsHash = object_hash_1.default(credentials.object);
        }
        cb(undefined, credentials);
    });
}
/**
 * starts listening on the queue for incoming jobs
 */
function startQueueListener() {
    logger('listening on the queue for incoming jobs');
    queue.process(identifier, (job, done) => {
        job.data.msg = crypto_1.default.decrypt(job.data.msg, parentSecret1 + parentSecret2);
        logger("platform process decrypted job " + job.data.msg['@type']);
        const sessionSecret = job.data.msg.sessionSecret;
        delete job.data.msg.sessionSecret;
        getCredentials(job.data.msg.actor['@id'], job.data.socket, sessionSecret, (err, credentials) => {
            if (err) {
                return done(err);
            }
            platform[job.data.msg['@type']](job.data.msg, credentials, done);
        });
    });
}
const queue = services_1.default.startQueue(parentId);
logger('process started');
//# sourceMappingURL=platform.js.map