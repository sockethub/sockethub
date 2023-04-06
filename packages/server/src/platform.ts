import debug, { Debugger } from "debug";
import { IActivityStream, CallbackInterface, IActivityObject } from "@sockethub/schemas";
import crypto, {getPlatformId} from "@sockethub/crypto";
import {CredentialsStore, JobQueue, RedisConfig} from "@sockethub/data-layer";
import {JobDataDecrypted} from "@sockethub/data-layer/src";

// command-line params
const parentId = process.argv[2];
const platformName = process.argv[3];
let identifier = process.argv[4];
const loggerPrefix = `sockethub:platform:${platformName}:${identifier}`;
let logger = debug(loggerPrefix);

const redisConfig = process.env.REDIS_URL ? process.env.REDIS_URL
  : { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PlatformModule = require(`@sockethub/platform-${platformName}`);

let jobQueue: JobQueue;
let jobQueueStarted = false;
let parentSecret1: string, parentSecret2: string;

logger(`platform handler initialized for ${platformName} ${identifier}`);

export type JobDoneCallback = (
  err?: Error|null|undefined,
  result?: IActivityStream|Array<IActivityStream>
) => void;

export interface PlatformSessionConfig {
  debug: Debugger;
  sendToClient?(msg: IActivityStream, special?: string): void;
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
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  process.send(['error', err.toString()]);
  process.exit(1);
});

/**
 * Incoming messages from the worker to this platform. Data is an array, the first property is the
 * method to call, the rest are params.
 */
process.on('message', async (data: SecretFromParent) => {
  if (data[0] === 'secrets') {
    const {parentSecret2: parentSecret3, parentSecret1: parentSecret} = data[1];
    parentSecret1 = parentSecret;
    parentSecret2 = parentSecret3;
    await startQueueListener();
  } else {
    throw new Error('received unknown command from parent thread');
  }
});

/**
 * Initialize platform module
 */
export const platformSession: PlatformSessionConfig = {
  debug: debug(`sockethub:platform:${platformName}:${identifier}`),
  sendToClient: getSendFunction('message'),
  updateActor: updateActor
};
const platform = new PlatformModule(platformSession);

/**
 * Returns a function used to handle completed jobs from the platform code (the `done` callback).
 */
function getJobHandler() {
  return (job: JobDataDecrypted, done: CallbackInterface) => {
    const jobLog = debug(`${loggerPrefix}:${job.sessionId}`);
    jobLog(`received ${job.title} ${job.msg.type}`);
    const credentialStore = new CredentialsStore(
      parentId, job.sessionId, parentSecret1 + job.msg.sessionSecret, redisConfig as RedisConfig
    );
    delete job.msg.sessionSecret;

    let jobCallbackCalled = false;
    const doneCallback: JobDoneCallback = (err: Error, result: IActivityStream) => {
      if (jobCallbackCalled) { return; }
      jobCallbackCalled = true;
      if (err) {
        jobLog(`failed ${job.title} ${job.msg.type}`);
        let errMsg;
        // some error objects (e.g. TimeoutError) don't interpolate correctly
        // to being human-readable, so we have to do this little dance
        try {
          errMsg = err.toString();
        } catch (e) {
          errMsg = err;
        }
        done(new Error(errMsg as string));
      } else {
        jobLog(`completed ${job.title} ${job.msg.type}`);
        done(undefined, result);
      }
    };

    platform.config.requireCredentials ? platform.config.requireCredentials : [];
    if (platform.config.requireCredentials.includes(job.msg.type)) {
      // this method requires credentials and should be called even if the platform is not
      // yet initialized, because they need to authenticate before they are initialized.
      credentialStore.get(job.msg.actor.id, platform.credentialsHash).then((credentials) => {
        platform[job.msg.type](job.msg, credentials, doneCallback);
      }).catch((err) => {
        jobLog('error ' + err.toString());
        return done(new Error(err.toString()));
      });
    } else if ((platform.config.persist) && (!platform.initialized)) {
      done(new Error(`${job.msg.type} called on uninitialized platform`));
    } else {
      platform[job.msg.type](job.msg, doneCallback);
    }
  };
}

/**
 * Get an function which sends a message to the parent thread (PlatformInstance). The platform
 * can call that function to send messages back to the client.
 * @param command string containing the type of command to be sent. 'message' or 'close'
 */
function getSendFunction(command: string) {
  return function (msg: IActivityStream, special?: string) {
    if (platform.config.persist) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      process.send([command, msg, special]);
    } else {
      logger('sendToClient called on non-persistent platform, rejecting.');
    }
  };
}

/**
 * When a user changes it's actor name, the channel identifier changes, we need to ensure that
 * both the queue thread (listening on the channel for jobs) and the logging object are updated.
 * @param credentials
 */
async function updateActor(credentials: IActivityStream) {
  identifier = getPlatformId(platformName, credentials.actor.id);
  logger(`platform actor updated to ${credentials.actor.id} identifier ${identifier}`);
  logger = debug(`sockethub:platform:${identifier}`);
  platform.credentialsHash = crypto.objectHash(credentials.object as IActivityObject);
  platform.debug = debug(`sockethub:platform:${platformName}:${identifier}`);
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  process.send(['updateActor', undefined, identifier]);
  await startQueueListener(true);
}

/**
 * Starts listening on the queue for incoming jobs
 * @param refresh boolean if the param is true, we re-init the queue.process
 * (used when identifier changes)
 */
async function startQueueListener(refresh = false) {
  if (jobQueueStarted) {
    if (refresh) {
      await jobQueue.shutdown();
    } else {
      logger('start queue called multiple times, skipping');
      return;
    }
  }
  jobQueue = new JobQueue(
    parentId, identifier, parentSecret1 + parentSecret2, redisConfig as RedisConfig
  );
  logger('listening on the queue for incoming jobs');
  jobQueue.onJob(getJobHandler());
  jobQueueStarted = true;
}
