import debug from 'debug';
import hash from "object-hash";
import services from './services';
import crypto from "./crypto";
import { getSessionStore, getPlatformId } from "./common";
import { MessageFromParent, ActivityObject } from './platform-instance';

// command-line params
const parentId = process.argv[2];
const platformName = process.argv[3];
let identifier = process.argv[4];

const logger = debug(`sockethub:platform:${identifier}`);
const queue = services.startQueue(parentId);
const PlatformModule = require(`sockethub-platform-${platformName}`);

logger(`platform handler initialized for ${platformName} ${identifier}`);

let queueStarted = false;
let parentSecret1: string, parentSecret2: string;
logger(`platform handler initialized for ${platformName} ${identifier}`);

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
process.on('message', (data: MessageFromParent) => {
  if (data[0] === 'secrets') {
    parentSecret1 = data[1].parentSecret1;
    parentSecret2 = data[1].parentSecret2;
    startQueueListener(identifier, parentSecret1 + parentSecret2);
  }
});

/**
 * sendFunction wrapper, generates a function to pass to the platform class. The platform can
 * call that function to send messages back to the client.
 * @param command
 */
function sendFunction(command: string) {
  return function (msg: ActivityObject, special?: string) {
    logger(`sending ${command} to client`);
    process.send([command, msg, special]);
  };
}

/**
 * Initialize platform module
 */
const platform = new PlatformModule({
  debug: debug(`sockethub:platform:${platformName}:${identifier}`),
  sendToClient: sendFunction('message'),
  updateActor: updateActor
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
  if (platform.config.noCredentials) { return cb(); }
  const store = getSessionStore(parentId, parentSecret1, sessionId, sessionSecret);
  store.get(actorId, (err, credentials) => {
    if (platform.config.persist) {
      // don't continue if we don't get credentials
      if (err) { return cb(err); }
    } else if (! credentials) {
      // also skip if this is a non-persist platform with no credentials
      return cb();
    }

    if (platform.credentialsHash) {
      if (platform.credentialsHash !== hash(credentials.object)) {
        return cb('provided credentials do not match existing platform instance for actor '
            + platform.actor['@id']);
      }
    } else {
      platform.credentialsHash = hash(credentials.object);
    }
    cb(undefined, credentials);
  });
}

function updateActor(credentials) {
  identifier = getPlatformId(platformName, credentials.actor['@id']);
  logger(`platform actor updated to ${credentials.actor['@id']} identifier ${identifier}`);
  platform.credentialsHash = hash(credentials.object);
  platform.debug = debug(`sockethub:platform:${platformName}:${identifier}`);
  process.send(['updateActor', undefined, identifier]);
}

/**
 * starts listening on the queue for incoming jobs
 */
function startQueueListener(_identifier: string, secret: string) {
  if (queueStarted) {
    logger('start queue called multiple times, skipping');
    return;
  }
  queueStarted = true;
  logger('listening on the queue for incoming jobs');
  queue.process(_identifier, (job, done: Function) => {
    job.data.msg = crypto.decrypt(job.data.msg, secret);
    logger(`platform process decrypted job ${job.data.msg['@type']}`);
    const sessionSecret = job.data.msg.sessionSecret;
    delete job.data.msg.sessionSecret;
    getCredentials(job.data.msg.actor['@id'], job.data.socket, sessionSecret,
                   (err, credentials) => {
                     if (err) { return done(err); }
                     platform[job.data.msg['@type']](job.data.msg, credentials, done);
                   });
  });
}

