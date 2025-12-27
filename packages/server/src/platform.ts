/**
 * This runs as a stand-alone separate process that handles starting up an
 * instance of a given platform, connecting to the redis job queue, sending the
 * platform jobs and handling the result by putting back on the queue for
 * sockethub core to send back to the client.
 *
 * If an exception is thrown by the platform, this process will die along with
 * it and sockethub will start up another process. This ensures memory safety.
 */
import { crypto, getPlatformId } from "@sockethub/crypto";
import type { JobHandler } from "@sockethub/data-layer";
import {
    CredentialsStore,
    type JobDataDecrypted,
    JobWorker,
} from "@sockethub/data-layer";
import type {
    ActivityStream,
    CredentialsObject,
    PlatformCallback,
    PlatformInterface,
    PlatformSession,
} from "@sockethub/schemas";
import debug from "debug";
import config from "./config";

// command-line params
const parentId = process.argv[2];
const platformName = process.argv[3];
let identifier = process.argv[4];
const redisUrl = process.env.REDIS_URL;

const loggerPrefix = `sockethub:platform:${platformName}:${identifier}`;
let logger = debug(loggerPrefix);

// conditionally initialize sentry
let sentry: { readonly reportError: (err: Error) => void } = {
    reportError: (_err: Error) => {},
};
(async () => {
    if (config.get("sentry:dsn")) {
        logger("initializing sentry");
        sentry = await import("./sentry");
    }
})();

let jobWorker: JobWorker;
let jobWorkerStarted = false;
let parentSecret1: string;
let parentSecret2: string;

logger(`platform handler initializing for ${platformName} ${identifier}`);

interface SecretInterface {
    parentSecret1: string;
    parentSecret2: string;
}

interface SecretFromParent extends Array<string | SecretInterface> {
    0: string;
    1: SecretInterface;
}

/**
 * Initialize platform module
 */
const platformSession: PlatformSession = {
    debug: debug(`sockethub:platform:${platformName}:${identifier}`),
    sendToClient: getSendFunction("message"),
    updateActor: updateActor,
};

const platform: PlatformInterface = await (async () => {
    const PlatformModule = await import(`@sockethub/platform-${platformName}`);
    const p = new PlatformModule.default(platformSession) as PlatformInterface;
    logger(`platform handler loaded for ${platformName} ${identifier}`);
    return p as PlatformInterface;
})();

/**
 * Handle any uncaught errors from the platform by alerting the worker and shutting down.
 */
process.once("uncaughtException", (err: Error) => {
    console.log("EXCEPTION IN PLATFORM");
    sentry.reportError(err);
    console.log("error:\n", err.stack);
    process.send(["error", err.toString()]);
    process.exit(1);
});

process.once("unhandledRejection", (err: Error) => {
    console.log("EXCEPTION IN PLATFORM");
    sentry.reportError(err);
    console.log("error:\n", err.stack);
    process.send(["error", err.toString()]);
    process.exit(1);
});

/**
 * In the case of a parent disconnect, terminate child process.
 */
// Detect parent death via IPC disconnect
process.on("disconnect", () => {
    console.log(`Parent disconnected. Child ${process.pid} exiting.`);
    process.exit(1);
});

/**
 * Incoming messages from the worker to this platform. Data is an array, the first property is the
 * method to call, the rest are params.
 */
process.on("message", async (data: SecretFromParent) => {
    if (data[0] === "secrets") {
        const { parentSecret2: parentSecret3, parentSecret1: parentSecret } =
            data[1];
        parentSecret1 = parentSecret;
        parentSecret2 = parentSecret3;
        await startQueueListener();
    } else {
        throw new Error("received unknown command from parent thread");
    }
});

/**
 * Returns a function used to handle completed jobs from the platform code (the `done` callback).
 */
function getJobHandler(): JobHandler {
    return async (
        job: JobDataDecrypted,
    ): Promise<string | undefined | ActivityStream> => {
        return new Promise((resolve, reject) => {
            const jobLog = debug(`${loggerPrefix}:${job.sessionId}`);
            jobLog(`received ${job.title} ${job.msg.type}`);
            const credentialStore = new CredentialsStore(
                parentId,
                job.sessionId,
                parentSecret1 + job.msg.sessionSecret,
                {
                    url: redisUrl,
                },
            );
            delete job.msg.sessionSecret;

            let jobCallbackCalled = false;
            const doneCallback: PlatformCallback = (
                err: Error | null,
                result: null | ActivityStream,
            ): void => {
                if (jobCallbackCalled) {
                    resolve(null);
                    return;
                }
                jobCallbackCalled = true;
                if (err) {
                    jobLog(`failed ${job.title} ${job.msg.type}`);
                    let errMsg: string | Error;
                    // some error objects (e.g. TimeoutError) don't interpolate correctly
                    // to being human-readable, so we have to do this little dance
                    try {
                        errMsg = err.toString();
                    } catch (err) {
                        errMsg = err;
                    }
                    sentry.reportError(new Error(errMsg as string));
                    reject(new Error(errMsg as string));
                } else {
                    jobLog(`completed ${job.title} ${job.msg.type}`);
                    resolve(result);
                }
            };

            if (platform.config.requireCredentials?.includes(job.msg.type)) {
                // this method requires credentials and should be called even if the platform is not
                // yet initialized, because they need to authenticate before they are initialized.
                credentialStore
                    .get(job.msg.actor.id, platform.credentialsHash)
                    .then((credentials) => {
                        platform[job.msg.type](
                            job.msg,
                            credentials,
                            doneCallback,
                        );
                    })
                    .catch((err) => {
                        console.error(err);
                        jobLog(`error ${err.toString()}`);
                        sentry.reportError(err);
                        reject(err);
                    });
            } else if (
                platform.config.persist &&
                !platform.config.initialized
            ) {
                reject(
                    new Error(
                        `${job.msg.type} called on uninitialized platform`,
                    ),
                );
            } else {
                try {
                    platform[job.msg.type](job.msg, doneCallback);
                } catch (err) {
                    jobLog(`platform call failed ${err.toString()}`);
                    sentry.reportError(err);
                    reject(err);
                }
            }
        });
    };
}

/**
 * Get a function which sends a message to the parent thread (PlatformInstance). The platform
 * can call that function to send messages back to the client.
 * @param command string containing the type of command to be sent. 'message' or 'close'
 */
function getSendFunction(command: string) {
    return (msg: ActivityStream, special?: string) => {
        if (platform.config.persist) {
            process.send([command, msg, special]);
        } else {
            logger(
                "sendToClient called on non-persistent platform, rejecting.",
            );
        }
    };
}

/**
 * When a user changes its actor name, the channel identifier changes, we need to ensure that
 * both the queue thread (listening on the channel for jobs) and the logging object are updated.
 * @param credentials
 */
async function updateActor(credentials: CredentialsObject): Promise<void> {
    identifier = getPlatformId(platformName, credentials.actor.id);
    logger(
        `platform actor updated to ${credentials.actor.id} identifier ${identifier}`,
    );
    logger = debug(`sockethub:platform:${identifier}`);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    platform.credentialsHash = crypto.objectHash(credentials.object);
    platform.debug = debug(`sockethub:platform:${platformName}:${identifier}`);
    process.send(["updateActor", undefined, identifier]);
    await startQueueListener(true);
}

/**
 * Starts listening on the queue for incoming jobs
 * @param refresh boolean if the param is true, we re-init the `queue.process`
 * (used when identifier changes)
 */
async function startQueueListener(refresh = false) {
    if (jobWorkerStarted) {
        if (refresh) {
            await jobWorker.shutdown();
        } else {
            logger("start queue called multiple times, skipping");
            return;
        }
    }
    jobWorker = new JobWorker(
        parentId,
        identifier,
        parentSecret1 + parentSecret2,
        { url: redisUrl },
    );
    logger("listening on the queue for incoming jobs");
    jobWorker.onJob(getJobHandler());
    jobWorkerStarted = true;
}
