import debug from 'debug';
import hash from "object-hash";
import config from './config';
import Queue from 'bull';
import { getPlatformId, decryptJobData } from "./common";
import { ActivityObject, JobDataDecrypted, JobEncrypted } from "./sockethub";
import { MessageFromParent } from './platform-instance';
import {getSessionStore} from "./store";

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

export interface PlatformSession {
  debug(msg: string): void;
  sendToClient(msg: ActivityObject, special?: string): void;
  updateActor(credentials: object): void;
}

/**
 * Handle any uncaught errors from the platform by alerting the worker and shutting down.
 */
process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION IN PLATFORM');
  // eslint-disable-next-line security-node/detect-crlf
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
const platformSession: PlatformSession = {
  debug: debug(`sockethub:platform:${platformName}:${identifier}`),
  sendToClient: getSendFunction('message'),
  updateActor: updateActor
};
const platform = new PlatformModule(platformSession);

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

/**
 * Returns a function used to handle completed jobs from the platform code (the `done` callback).
 * @param secret the secret used to decrypt credentials
 */
function getJobHandler(secret: string) {
  return (job: JobEncrypted, done: Function) => {
    const jobData: JobDataDecrypted = decryptJobData(job, secret);
    const jobLog = debug(`${loggerPrefix}:${jobData.sessionId}`);
    jobLog(`job ${jobData.title}: ${jobData.msg['@type']}`);
    const sessionSecret = jobData.msg.sessionSecret;
    delete jobData.msg.sessionSecret;

    return getCredentials(jobData.msg.actor['@id'], jobData.sessionId, sessionSecret,
      (err, credentials) => {
        if (err) { return done(new Error(err)); }
        let jobCallbackCalled = false;
        const doneCallback = (err, result) => {
          if (jobCallbackCalled) { return; }
          jobCallbackCalled = true;
          if (err) {
            done(err instanceof Error ? err : new Error(err));
          } else {
            done(null, result);
          }
        };
        if ((Array.isArray(platform.config.requireCredentials)) &&
          (platform.config.requireCredentials.includes(jobData.msg['@type']))) {
          // add the credentials object if this method requires it
          platform[jobData.msg['@type']](jobData.msg, credentials, doneCallback);
        } else {
          platform[jobData.msg['@type']](jobData.msg, doneCallback);
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
  const queue = new Queue(parentId + identifier, { redis: config.get('redis') });
  queueStarted = true;
  logger('listening on the queue for incoming jobs');
  queue.process(getJobHandler(secret));
}
