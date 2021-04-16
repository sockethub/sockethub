import debug from 'debug';
import hash from "object-hash";
import redisConfig from './services/redis';
import crypto from "./crypto";
import Queue from 'bull';
import { getSessionStore, getPlatformId, Store } from "./common";
import { ActivityObject, Job } from "./sockethub";
import { MessageFromParent } from './platform-instance';

// command-line params
const parentId = process.argv[2];
const platformName = process.argv[3];
let identifier = process.argv[4];
const loggerPrefix = `sockethub:platform:${platformName}:${identifier}`;
let logger = debug(loggerPrefix);

const PlatformModule = require(`sockethub-platform-${platformName}`);

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
    startQueueListener();
  }
});


/**
 * Initialize platform module
 */
const platform = new PlatformModule({
  debug: debug(`sockethub:platform:${platformName}:${identifier}`),
  sendToClient: getSendFunction('message'),
  updateActor: updateActor
});

/**
 * Get the credentials stored for this user in this sessions store, if given the correct
 * sessionSecret.
 * @param actorId
 * @param sessionId
 * @param sessionSecret
 * @param cb
 */
function getCredentials(actorId: string, sessionId: string, sessionSecret: string, cb: Function) {
  if (platform.config.noCredentials) { return cb(); }
  const store: Store = getSessionStore(parentId, parentSecret1, sessionId, sessionSecret);
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

/**
 * Returns a function used to handle completed jobs from the platform code (the `done` callback).
 * @param secret the secret used to decrypt credentials
 */
function getJobHandler(secret: string) {
  return (job: Job, done: Function) => {
    job.data.msg = crypto.decrypt(job.data.msg, secret);
    const jobLog = debug(`${loggerPrefix}:${job.data.sessionId}`);
    jobLog(`job ${job.data.title}: ${job.data.msg['@type']}`);
    const sessionSecret = job.data.msg.sessionSecret;
    delete job.data.msg.sessionSecret;

    return getCredentials(job.data.msg.actor['@id'], job.data.sessionId, sessionSecret,
      (err, credentials) => {
        if (err) { return done(new Error(err)); }
        const doneCallback = (err, result) => {
          if (err) {
            done(new Error(err));
          } else {
            done(null, result);
          }
        };
        if ((Array.isArray(platform.config.requireCredentials)) &&
          (platform.config.requireCredentials.includes(job.data.msg['@type']))) {
          // add the credentials object if this method requires it
          platform[job.data.msg['@type']](job.data.msg, credentials, doneCallback);
        } else {
          platform[job.data.msg['@type']](job.data.msg, doneCallback);
        }
      });
  };
}

/**
 * Get an function which sends a message to the parent thread (PlatformInstance). The platform
 * can call that function to send messages back to the client.
 * @param command string containing the type of command to be sent. 'message' or 'close'
 */
function getSendFunction(command: string) {
  return function (msg: ActivityObject, special?: string) {
    process.send([command, msg, special]);
  };
}

/**
 * When a user changes it's actor name, the channel identifier changes, we need to ensure that
 * both the queue thread (listening on the channel for jobs) and the logging object are updated.
 * @param credentials
 */
function updateActor(credentials) {
  identifier = getPlatformId(platformName, credentials.actor['@id']);
  logger(`platform actor updated to ${credentials.actor['@id']} identifier ${identifier}`);
  logger = debug(`sockethub:platform:${identifier}`);
  platform.credentialsHash = hash(credentials.object);
  platform.debug = debug(`sockethub:platform:${platformName}:${identifier}`);
  process.send(['updateActor', undefined, identifier]);
  startQueueListener(true);
}

/**
 * starts listening on the queue for incoming jobs
 * @param refresh boolean if the param is true, we re-init the queue.process
 * (used when identifier changes)
 */
function startQueueListener(refresh: boolean = false) {
  const secret = parentSecret1 + parentSecret2;
  if ((queueStarted) && (!refresh)) {
    logger('start queue called multiple times, skipping');
    return;
  }
  const queue = new Queue(parentId + identifier, redisConfig);
  queueStarted = true;
  logger('listening on the queue for incoming jobs');
  queue.process(getJobHandler(secret));
}
