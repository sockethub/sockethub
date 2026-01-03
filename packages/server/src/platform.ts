/**
 * This runs as a stand-alone separate process that handles:
 * 1. Starting up an instance of a given platform
 * 2. Connecting to the redis job queue
 * 3. Sending the platform jobs
 * 4. Handling the result by putting it in the outgoing queue for
 * sockethub core to send back to the client.
 *
 * If an exception is thrown by the platform, this process will die along with
 * it and sockethub will start up another process. This ensures memory safety.
 */
import { crypto, getPlatformId } from "@sockethub/crypto";
import {
    CredentialsStore,
    type JobDataDecrypted,
    JobWorker,
} from "@sockethub/data-layer";
import type { JobHandler } from "@sockethub/data-layer";
import type {
    ActivityStream,
    CredentialsObject,
    PersistentPlatformInterface,
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
    reportError: (err: Error) => {},
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
 * Type guard to check if a platform is persistent and has credentialsHash.
 */
function isPersistentPlatform(
    platform: PlatformInterface,
): platform is PersistentPlatformInterface {
    return platform.config.persist === true;
}

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
            // biome-ignore lint/performance/noDelete: <explanation>
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
                // This method requires credentials and should be called even if the platform is not
                // yet initialized, because they need to authenticate before they are initialized.

                // Get credentialsHash for validation.
                // For persistent platforms: validates credentials match the platform instance
                // For stateless platforms: undefined (no validation, credentials used once)
                const credentialsHash = isPersistentPlatform(platform)
                    ? platform.credentialsHash
                    : undefined;

                credentialStore
                    .get(job.msg.actor.id, credentialsHash)
                    .then((credentials) => {
                        // Create wrapper callback that updates credentialsHash after successful call
                        const wrappedCallback: PlatformCallback = (
                            err: Error | null,
                            result: null | ActivityStream,
                        ): void => {
                            if (!err && isPersistentPlatform(platform)) {
                                // Update credentialsHash after successful platform call.
                                // Only persistent platforms track credential state across requests.
                                platform.credentialsHash = crypto.objectHash(
                                    credentials.object,
                                );
                            }
                            doneCallback(err, result);
                        };

                        // Proceed with platform method call
                        platform[job.msg.type](
                            job.msg,
                            credentials,
                            wrappedCallback,
                        );
                    })
                    .catch((err) => {
                        // Credential store error (invalid/missing credentials)
                        jobLog(`credential error ${err.toString()}`);

                        /**
                         * Critical distinction: handle credential errors differently based on platform state.
                         *
                         * For INITIALIZED platforms (already running):
                         * - Reject ONLY this job via doneCallback(err, null)
                         * - Keep the platform process running
                         * - Why: Platform instances can be shared by multiple clients (sessions).
                         *   Terminating on credential error would crash the platform for ALL users,
                         *   including those with valid credentials. This would create a DoS vector
                         *   where one user's mistake (browser refresh with wrong creds, mistyped
                         *   password, expired token) would break the service for everyone sharing
                         *   that platform instance.
                         * - The failing client receives an error message, while other clients
                         *   continue operating normally.
                         *
                         * For UNINITIALIZED platforms (not yet started):
                         * - Terminate the platform process via reject(err)
                         * - Why: If the initial connection fails due to invalid credentials, there's
                         *   no valid session to preserve. The platform instance was created specifically
                         *   for this connection attempt and has no other users. Terminating allows
                         *   proper cleanup and a fresh start on the next attempt.
                         * - Error is reported to Sentry for monitoring authentication issues.
                         */
                        if (platform.config.initialized) {
                            // Platform already running - reject job only, preserve platform instance
                            doneCallback(err, null);
                        } else {
                            // Platform not initialized - terminate platform process
                            sentry.reportError(err);
                            reject(err);
                        }
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

    // Update credentialsHash for persistent platforms (tracks actor-specific state)
    if (isPersistentPlatform(platform)) {
        platform.credentialsHash = crypto.objectHash(credentials.object);
    }

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
