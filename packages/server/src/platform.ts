import debug from 'debug';
import hash from "object-hash";
import Queue from 'bull';
import {IActivityStream} from "@sockethub/schemas";
import {decryptJobData, getPlatformId} from "./common";
import {JobDataDecrypted, JobEncrypted} from "./sockethub";
import {getSessionStore} from "./store";
import {CallbackInterface} from "./basic-types";

// command-line params
const parentId = process.argv[2];
const platformName = process.argv[3];
let identifier = process.argv[4];
const loggerPrefix = `sockethub:platform:${platformName}:${identifier}`;
let logger = debug(loggerPrefix);

const redisConfig = process.env.REDIS_URL ? process.env.REDIS_URL
  : { redis: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT }};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PlatformModule = require(`@sockethub/platform-${platformName}`);

let queueStarted = false;
let parentSecret1: string, parentSecret2: string;

logger(`platform handler initialized for ${platformName}`);

export interface PlatformSession {
  debug(msg: string): void;
  sendToClient(msg: IActivityStream, special?: string): void;
  updateActor(credentials: object): void;
}
interface SecretInterface {
  parentSecret1: string,
  parentSecret2: string
}
interface SecretFromParent extends Array<string|SecretInterface>{0: string, 1: SecretInterface}

/**
 * Handle any uncaught errors from the platform by alerting the worker and shutting down.
 */
process.on('uncaughtException', (err) => {
  console.log('EXCEPTION IN PLATFORM');
  // eslint-disable-next-line security-node/detect-crlf
  console.log(err.stack);
  process.send(['error', err.toString()]);
  process.exit(1);
});

/**
 * Incoming messages from the worker to this platform. Data is an array, the first property is the
 * method to call, the rest are params.
 */
process.on('message', (data: SecretFromParent) => {
  if (data[0] !== 'secrets') {
    return;
  }
  const {parentSecret2: parentSecret3, parentSecret1: parentSecret} = data[1];
  parentSecret1 = parentSecret;
  parentSecret2 = parentSecret3;
  startQueueListener();
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
 */
async function getCredentials(
  actorId: string, sessionId: string, sessionSecret: string
) {
  if (platform.config.noCredentials) { return undefined; }
  const store = await getSessionStore(parentId, parentSecret1, sessionId, sessionSecret);
  const credentials = await store.get(actorId);
  if (platform.config.persist) {
    // don't continue if we don't get credentials
    if (!credentials) {
      throw new Error("unable to find credentials");
    }
  } else if (!credentials) {
    // also skip without error if this is a non-persist platform with no credentials
    return undefined;
  }

  if (platform.credentialsHash) {
    if (platform.credentialsHash !== hash(credentials.object)) {
      throw new Error('provided credentials do not match existing platform instance for actor '
          + platform.actor.id);
    }
  } else {
    platform.credentialsHash = hash(credentials.object);
  }
  return credentials;
}

/**
 * Returns a function used to handle completed jobs from the platform code (the `done` callback).
 * @param secret the secret used to decrypt credentials
 */
function getJobHandler(secret: string) {
  return async (job: JobEncrypted, done: CallbackInterface) => {
    const jobData: JobDataDecrypted = decryptJobData(job, secret);
    const jobLog = debug(`${loggerPrefix}:${jobData.sessionId}`);
    jobLog(`received ${jobData.title} ${jobData.msg.type}`);
    const sessionSecret = jobData.msg.sessionSecret;
    delete jobData.msg.sessionSecret;

    let credentials;
    try {
      credentials = await getCredentials(
        jobData.msg.actor.id, jobData.sessionId, sessionSecret
      );
    } catch (err) {
      return done(err);
    }
    let jobCallbackCalled = false;
    const doneCallback = (err, result) => {
      if (jobCallbackCalled) { return; }
      jobCallbackCalled = true;
      if (err) {
        jobLog(`errored ${jobData.title} ${jobData.msg.type}`);
        let errMsg;
        // some error objects (eg. TimeoutError) don't interpolate correctly to human-readable
        // so, we have to do this little dance
        try {
          errMsg = err.toString();
        } catch (e) {
          errMsg = err;
        }
        done(new Error(errMsg));
      } else {
        jobLog(`completed ${jobData.title} ${jobData.msg.type}`);
        done(null, result);
      }
    };
    if ((Array.isArray(platform.config.requireCredentials)) &&
      (platform.config.requireCredentials.includes(jobData.msg.type))) {
      // add the credentials object if this method requires it
      platform[jobData.msg.type](jobData.msg, credentials, doneCallback);
    } else if (platform.config.persist) {
      if (platform.initialized) {
        platform[jobData.msg.type](jobData.msg, doneCallback);
      } else {
        done(new Error(`${jobData.msg.type} called on uninitialized platform`));
      }
    } else {
      platform[jobData.msg.type](jobData.msg, doneCallback);
    }
  };
}

/**
 * Get a function which sends a message to the parent thread (PlatformInstance). The platform
 * can call that function to send messages back to the client.
 * @param command string containing the type of command to be sent. 'message' or 'close'
 */
function getSendFunction(command: string) {
  return function (msg: IActivityStream, special?: string) {
    process.send([command, msg, special]);
  };
}

/**
 * When a user changes its actor name, the channel identifier changes, we need to ensure that
 * both the queue thread (listening on the channel for jobs) and the logging object are updated.
 * @param credentials
 */
function updateActor(credentials) {
  identifier = getPlatformId(platformName, credentials.actor.id);
  logger(`platform actor updated to ${credentials.actor.id} identifier ${identifier}`);
  logger = debug(`sockethub:platform:${identifier}`);
  platform.credentialsHash = hash(credentials.object);
  platform.debug = debug(`sockethub:platform:${platformName}:${identifier}`);
  process.send(['updateActor', undefined, identifier]);
  startQueueListener(true);
}

/**
 * starts listening on the queue for incoming jobs
 * @param refresh boolean if the param is true, we re-init the `queue.process`
 * (used when identifier changes)
 */
function startQueueListener(refresh = false) {
  const secret = parentSecret1 + parentSecret2;
  if ((queueStarted) && (!refresh)) {
    logger('start queue called multiple times, skipping');
    return;
  }
  // eslint-disable-next-line security-node/detect-crlf
  logger(`platform thread redis config: ${redisConfig}`);
  const queue = new Queue(parentId + identifier, { redis: redisConfig });
  queueStarted = true;
  logger('listening on the queue for incoming jobs');
  queue.process(getJobHandler(secret));
}
