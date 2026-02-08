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
import type { JobHandler } from "@sockethub/data-layer";
import {
    CredentialsStore,
    type JobDataDecrypted,
    JobWorker,
} from "@sockethub/data-layer";
import { createLogger, type Logger, setLoggerContext } from "@sockethub/logger";
import type {
    ActivityStream,
    CredentialsObject,
    PersistentPlatformInterface,
    PlatformCallback,
    PlatformInterface,
    PlatformSession,
} from "@sockethub/schemas";
import config from "./config";

// Simple wrapper function to help with testing
export function derivePlatformCredentialsSecret(
    parentSecret: string,
    sessionSecret: string,
): string {
    return crypto.deriveSecret(parentSecret, sessionSecret);
}

async function startPlatformProcess() {
    // command-line params
    const parentId = process.argv[2];
    const platformName = process.argv[3];
    let identifier = process.argv[4];
    const redisUrl = process.env.REDIS_URL;

    // Set process-wide context for all loggers in this platform process
    setLoggerContext(`sockethub:platform:${platformName}:${identifier}`);

    const loggerPrefix = "main";
    let logger = createLogger(loggerPrefix);

    // Cache logger instances per session to avoid recreating Winston loggers with transports
    const loggerCache = new Map<string, Logger>();

    // conditionally initialize sentry
    let sentry: { readonly reportError: (err: Error) => void } = {
        reportError: (err: Error) => {
            logger.debug(
                "Sentry not configured; error not reported to Sentry",
                {
                    error: err,
                },
            );
        },
    };
    (async () => {
        if (config.get("sentry:dsn")) {
            logger.info("initializing sentry");
            sentry = await import("./sentry");
        }
    })();

    let jobWorker: JobWorker;
    let jobWorkerStarted = false;
    let parentSecret1: string;
    let parentSecret2: string;

    logger.debug(
        `platform handler initializing for ${platformName} ${identifier}`,
    );

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
        log: logger, // Reuse the logger created above
        sendToClient: getSendFunction("message"),
        updateActor: updateActor,
    };

    const platform: PlatformInterface = await (async () => {
        const PlatformModule = await import(
            `@sockethub/platform-${platformName}`
        );
        const p = new PlatformModule.default(
            platformSession,
        ) as PlatformInterface;
        logger.info(
            `platform handler loaded for ${platformName} ${identifier}`,
        );
        return p as PlatformInterface;
    })();

    type PlatformHandlerWithCredentials = (
        msg: ActivityStream,
        credentials: CredentialsObject,
        cb: PlatformCallback,
    ) => void;
    type PlatformHandler = (msg: ActivityStream, cb: PlatformCallback) => void;
    function getPlatformHandler(
        instance: PlatformInterface,
        name: string,
    ): PlatformHandlerWithCredentials | PlatformHandler | undefined {
        const candidate = (
            instance as PlatformInterface & Record<string, unknown>
        )[name];
        return typeof candidate === "function"
            ? (candidate as PlatformHandlerWithCredentials | PlatformHandler)
            : undefined;
    }

    const heartbeatIntervalMs = Number(
        config.get("platformHeartbeat:intervalMs") ?? 5000,
    );
    let heartbeatTimer: NodeJS.Timeout | undefined;

    /**
     * Safely send message to parent process, handling IPC channel closure
     */
    function safeProcessSend(message: [string, unknown]) {
        if (process.send && process.connected) {
            try {
                process.send(message);
            } catch (ipcErr) {
                console.error(
                    `Failed to report error via IPC: ${
                        ipcErr instanceof Error
                            ? ipcErr.message
                            : String(ipcErr)
                    }`,
                );
            }
        } else {
            console.error("Cannot report error: IPC channel not available");
        }
    }

    function startHeartbeat() {
        if (!Number.isFinite(heartbeatIntervalMs) || heartbeatIntervalMs <= 0) {
            return;
        }
        if (heartbeatTimer) {
            return;
        }
        heartbeatTimer = setInterval(() => {
            safeProcessSend([
                "heartbeat",
                {
                    type: "heartbeat",
                    context: "sockethub:internal",
                    actor: {
                        id: "sockethub",
                        type: "platform",
                    },
                    object: {
                        type: "heartbeat",
                        timestamp: Date.now(),
                    },
                } as ActivityStream,
            ]);
        }, heartbeatIntervalMs);
    }

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
        safeProcessSend(["error", err.toString()]);
        process.exit(1);
    });

    process.once("unhandledRejection", (err: Error) => {
        console.log("EXCEPTION IN PLATFORM");
        sentry.reportError(err);
        console.log("error:\n", err.stack);
        safeProcessSend(["error", err.toString()]);
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

    process.once("exit", () => {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
        }
    });

    /**
     * Incoming messages from the worker to this platform. Data is an array, the first property is the
     * method to call, the rest are params.
     */
    process.on("message", async (data: SecretFromParent) => {
        if (data[0] === "secrets") {
            const {
                parentSecret2: parentSecret3,
                parentSecret1: parentSecret,
            } = data[1];
            parentSecret1 = parentSecret;
            parentSecret2 = parentSecret3;
            await startQueueListener();
            startHeartbeat();
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
                // Use cached logger to avoid creating Winston instances per job
                const logKey = job.sessionId;
                let jobLog = loggerCache.get(logKey);
                if (!jobLog) {
                    jobLog = createLogger(logKey);
                    loggerCache.set(logKey, jobLog);
                }
                jobLog.debug(`received ${job.title} ${job.msg.type}`);
                const credentialStore = new CredentialsStore(
                    parentId,
                    job.sessionId,
                    derivePlatformCredentialsSecret(
                        parentSecret1,
                        job.msg.sessionSecret,
                    ),
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
                        jobLog.error(`failed ${job.title} ${job.msg.type}`);
                        let errMsg: string | Error;
                        // some error objects (e.g. TimeoutError) don't interpolate correctly
                        // to being human-readable, so we have to do this little dance
                        try {
                            errMsg = err.toString();
                        } catch (err) {
                            errMsg = err instanceof Error ? err : String(err);
                        }
                        const errorMessage =
                            errMsg instanceof Error ? errMsg.message : errMsg;
                        sentry.reportError(new Error(errorMessage));
                        reject(new Error(errorMessage));
                    } else {
                        jobLog.debug(`completed ${job.title} ${job.msg.type}`);

                        // Validate that persistent platforms set their initialized state correctly
                        if (
                            platform.config.persist &&
                            platform.config.requireCredentials?.includes(
                                job.msg.type,
                            ) &&
                            !platform.isInitialized()
                        ) {
                            logger.warn(
                                `Platform ${platform.schema.name} completed '${job.msg.type}' but isInitialized() returned false. Platforms should implement isInitialized() to return true once ready to handle jobs.`,
                            );
                        }

                        resolve(result);
                    }
                };

                if (
                    platform.config.requireCredentials?.includes(job.msg.type)
                ) {
                    // This method requires credentials and should be called even if the platform is not
                    // yet initialized, because they need to authenticate before they are initialized.

                    // Get credentialsHash for validation.
                    // For persistent platforms: undefined (or empty string) initially, then we set to hash after first
                    // successful call.
                    // For stateless platforms: always undefined (no validation, credentials used once per request)
                    // CredentialsStore skips validation when credentialsHash is falsy (undefined or empty string)
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
                                    platform.credentialsHash =
                                        crypto.objectHash(credentials.object);
                                }
                                doneCallback(err, result);
                            };

                            // Proceed with platform method call
                            const handler = getPlatformHandler(
                                platform,
                                job.msg.type,
                            );
                            if (!handler) {
                                doneCallback(
                                    new Error(
                                        `platform method ${job.msg.type} not available`,
                                    ),
                                    null,
                                );
                                return;
                            }
                            (handler as PlatformHandlerWithCredentials).call(
                                platform,
                                job.msg,
                                credentials,
                                wrappedCallback,
                            );
                        })
                        .catch((err) => {
                            // Credential store error (invalid/missing credentials)
                            jobLog.error(`credential error ${String(err)}`);

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
                            if (platform.isInitialized()) {
                                // Platform already running - reject job only, preserve platform instance
                                doneCallback(
                                    err instanceof Error
                                        ? err
                                        : new Error(String(err)),
                                    null,
                                );
                            } else {
                                // Platform not initialized - terminate platform process
                                const error =
                                    err instanceof Error
                                        ? err
                                        : new Error(String(err));
                                sentry.reportError(error);
                                reject(error);
                            }
                        });
                } else if (
                    platform.config.persist &&
                    !platform.isInitialized()
                ) {
                    reject(
                        new Error(
                            `${job.msg.type} called on uninitialized platform`,
                        ),
                    );
                } else {
                    try {
                        const handler = getPlatformHandler(
                            platform,
                            job.msg.type,
                        );
                        if (!handler) {
                            throw new Error(
                                `platform method ${job.msg.type} not available`,
                            );
                        }
                        (handler as PlatformHandler).call(
                            platform,
                            job.msg,
                            doneCallback,
                        );
                    } catch (err) {
                        const error =
                            err instanceof Error ? err : new Error(String(err));
                        jobLog.error(
                            `platform call failed ${error.toString()}`,
                        );
                        sentry.reportError(error);
                        reject(error);
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
                logger.warn(
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
        logger.info(
            `platform actor updated to ${credentials.actor.id} identifier ${identifier}`,
        );
        // Update context with new identifier
        setLoggerContext(`sockethub:platform:${platformName}:${identifier}`);
        logger = createLogger("main");

        // Update credentialsHash for persistent platforms (tracks actor-specific state)
        if (isPersistentPlatform(platform)) {
            platform.credentialsHash = crypto.objectHash(credentials.object);
        }

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
                logger.warn("start queue called multiple times, skipping");
                return;
            }
        }
        jobWorker = new JobWorker(
            parentId,
            identifier,
            parentSecret1 + parentSecret2,
            { url: redisUrl },
        );
        logger.info("listening on the queue for incoming jobs");
        jobWorker.onJob(getJobHandler());
        jobWorkerStarted = true;
    }
}

if (process.env.SOCKETHUB_PLATFORM_CHILD === "1") {
    void startPlatformProcess();
}
