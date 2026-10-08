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

import type { JobHandler } from "@sockethub/data-layer";
import {
    buildCredentialsKey,
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
    PlatformConfig,
    PlatformInterface,
    PlatformSession,
} from "@sockethub/schemas";
import {
    buildCanonicalContext,
    INTERNAL_PLATFORM_CONTEXT_URL,
} from "@sockethub/schemas";
import { crypto, getPlatformId } from "@sockethub/util/crypto";
import { errorMessage, isExpectedError, toError } from "@sockethub/util/error";
import config from "./config";
import { resolveSentryConfig } from "./sentry-config.js";

// Simple wrapper function to help with testing
/**
 * Merge per-platform config (forwarded from the parent's `packageConfig` as a
 * JSON string in `SOCKETHUB_PLATFORM_CONFIG`) onto the platform's own config
 * defaults. Platform defaults win for any key the file does not set. Throws on
 * malformed JSON so the caller can log it rather than silently using defaults.
 */
export function mergePackageConfig(
    base: PlatformConfig,
    rawConfig: string | undefined,
): PlatformConfig {
    if (!rawConfig) {
        return base;
    }
    const parsed = JSON.parse(rawConfig);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("SOCKETHUB_PLATFORM_CONFIG must be a JSON object");
    }
    return { ...base, ...(parsed as Partial<PlatformConfig>) };
}

export function derivePlatformCredentialsSecret(
    parentSecret: string,
    sessionSecret: string,
): string {
    return crypto.deriveSecret(parentSecret, sessionSecret);
}

/**
 * Write credentials after the platform has renamed the actor (IRC nick
 * change). The next credentialed command loads this key and compares the
 * object to `credentialsHash`; leaving Redis under the pre-rename actor
 * fails that check and detaches the session from the live connection.
 */
export async function storeActorCredentials(
    store: {
        save(key: string, creds: CredentialsObject): Promise<unknown>;
    },
    platformName: string,
    credentials: CredentialsObject,
): Promise<void> {
    const actorId = credentials.actor?.id;
    if (typeof actorId !== "string" || actorId.length === 0) {
        throw new Error(
            `cannot store updated credentials for ${platformName} without an actor id`,
        );
    }
    await store.save(buildCredentialsKey(platformName, actorId), credentials);
}

export interface CredentialStoreReader {
    get(key: string, credentialsHash?: string): Promise<CredentialsObject>;
    save(key: string, creds: CredentialsObject): Promise<unknown>;
    objectHash?(object: unknown): string;
}

function credentialsNotFound(err: unknown): boolean {
    return (
        err instanceof Error &&
        err.message.startsWith("credentials not found for ")
    );
}

/**
 * Moves one session's stored credentials from the pre-rename actor to the new
 * actor. Skips peers that never stored the account being renamed. Refuses to
 * overwrite a different account already stored under the new actor id.
 * `dryRun` runs the same checks without writing.
 */
export async function renameActorCredentialsInStore(
    store: CredentialStoreReader,
    platformName: string,
    previousActorId: string,
    renamed: CredentialsObject,
    options?: { dryRun?: boolean },
): Promise<"migrated" | "skipped"> {
    const newActorId = renamed.actor?.id;
    if (typeof newActorId !== "string" || newActorId.length === 0) {
        throw new Error(
            `cannot rename ${platformName} credentials without a new actor id`,
        );
    }
    const oldKey = buildCredentialsKey(platformName, previousActorId);
    const newKey = buildCredentialsKey(platformName, newActorId);
    if (oldKey === newKey) {
        return "skipped";
    }

    try {
        await store.get(oldKey);
    } catch (err) {
        if (credentialsNotFound(err)) {
            return "skipped";
        }
        throw err;
    }

    const objectHash = store.objectHash ?? crypto.objectHash;
    try {
        const existingAtNew = await store.get(newKey);
        if (objectHash(existingAtNew.object) !== objectHash(renamed.object)) {
            throw new Error(
                `cannot rename ${previousActorId} to ${newActorId}: credentials already stored for ${newActorId}`,
            );
        }
        return "skipped";
    } catch (err) {
        if (!credentialsNotFound(err)) {
            throw err;
        }
    }

    if (options?.dryRun) {
        return "migrated";
    }
    await store.save(newKey, renamed);
    return "migrated";
}

export interface SessionCredentialWriter {
    sessionId: string;
    renameActorCredentials(
        previousActorId: string,
        renamed: CredentialsObject,
    ): Promise<"migrated" | "skipped">;
}

/**
 * Persists renamed credentials for every attached session except the one that
 * already stored them in the platform child before reporting the actor change.
 */
export async function migrateRenamedActorCredentials(
    platformName: string,
    previousActorId: string,
    credentials: CredentialsObject,
    writers: Iterable<SessionCredentialWriter>,
): Promise<void> {
    const failures: string[] = [];
    for (const writer of writers) {
        try {
            await writer.renameActorCredentials(previousActorId, credentials);
        } catch (err) {
            failures.push(`${writer.sessionId}: ${errorMessage(err)}`);
        }
    }
    if (failures.length > 0) {
        throw new Error(
            `failed to migrate renamed ${platformName} credentials for ${failures.length} session(s): ${failures.join("; ")}`,
        );
    }
}

async function startPlatformProcess() {
    // command-line params
    const parentId = process.argv[2];
    const platformName = process.argv[3];
    let identifier = process.argv[4];
    const redisUrl = process.env.REDIS_URL;
    // Forwarded by PlatformInstance; reads from this process then refresh the
    // sliding expiry on the session's credential key. undefined disables TTL.
    const credentialsTtlMs =
        Number(process.env.SOCKETHUB_CREDENTIALS_TTL_MS) || undefined;

    // Set process-wide context for all loggers in this platform process
    setLoggerContext(`sockethub:platform:${platformName}:${identifier}`);

    const loggerPrefix = "main";
    let logger = createLogger(loggerPrefix);

    // Cache logger instances per session to avoid recreating Winston loggers with transports
    const loggerCache = new Map<string, Logger>();

    // conditionally initialize sentry
    let sentry: {
        readonly reportError: (err: Error) => void;
        readonly flush?: (timeoutMs?: number) => Promise<boolean>;
        readonly count?: (
            name: string,
            value?: number,
            attributes?: Record<string, string | number | boolean>,
        ) => void;
    } = {
        reportError: (err: Error) => {
            logger.debug(
                "Sentry not configured; error not reported to Sentry",
                {
                    error: err,
                    errorMessage: err?.message ?? String(err),
                    errorStack: err?.stack,
                },
            );
        },
    };
    // Registered before any awaited startup work: an import that rejects
    // during startup would otherwise never reach the handlers, and the worker
    // would die without notifying the parent or reporting to Sentry.
    // `reportFatal` and `safeProcessSend` are function declarations, so they
    // are hoisted and callable from here.
    // Neither a thrown value nor a rejection reason is guaranteed to be an
    // Error — `throw null` and `Promise.reject(null)` both reach here — and a
    // non-Error would throw on `.stack` inside the handler, losing the very
    // report it exists to make. Normalize both first.
    process.once("uncaughtException", (err: unknown) => {
        void reportFatal(toError(err));
    });

    process.once("unhandledRejection", (err: unknown) => {
        void reportFatal(toError(err));
    });

    // Awaited (not fire-and-forget) so a crash during the rest of startup is
    // reported to Sentry rather than to the no-op stub above. Resolved from
    // the parent's forwarded settings, not this process's own config: a
    // worker is forked without the server's config file.
    if (resolveSentryConfig().dsn) {
        logger.info("initializing sentry");
        sentry = await import("./sentry");
    }

    let jobWorker: JobWorker;
    let jobWorkerStarted = false;
    let parentSecret1: string;
    let parentSecret2: string;
    // Set for the duration of a credentialed job so updateActor can persist
    // a renamed actor before the job callback returns. Persistent platforms
    // run one job at a time, so a single slot is unambiguous.
    let credentialsStoreForActorUpdate: CredentialsStore | undefined;
    // Session that owns the in-flight credentialed job. Forwarded with the
    // actor-change IPC so the parent can migrate credentials for every other
    // session sharing this connection.
    let actorUpdateSessionId: string | undefined;
    // Actor id the in-flight job loaded credentials for, before the platform
    // mutates that object to the new nick. Needed so the rename can refuse to
    // overwrite a different account already stored at the target id.
    let actorUpdatePreviousActorId: string | undefined;

    function clearActorUpdateContext(): void {
        credentialsStoreForActorUpdate = undefined;
        actorUpdateSessionId = undefined;
        actorUpdatePreviousActorId = undefined;
    }
    // Immutable queue name allocated when this worker was forked. Distinct
    // from `identifier`, which moves on actor rename and can be reused by a
    // later connection with the original actor.
    const queueInstanceId =
        process.env.SOCKETHUB_QUEUE_INSTANCE_ID ?? identifier;

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

    type MessageFromParent =
        | SecretFromParent
        | ["updateActorAck"]
        | ["updateActorFailed", string];

    let pendingUpdateActorAck:
        | {
              resolve: () => void;
              reject: (err: Error) => void;
          }
        | undefined;

    /**
     * Initialize platform module
     */
    const platformSession: PlatformSession = {
        log: logger, // Reuse the logger created above
        sendToClient: getSendFunction("message"),
        updateActor: updateActor,
        prepareActorUpdate: prepareActorUpdate,
    };

    const platform: PlatformInterface = await (async () => {
        const PlatformModule = await import(
            `@sockethub/platform-${platformName}`
        );
        const p = new PlatformModule.default(
            platformSession,
        ) as PlatformInterface;
        // Apply per-platform config from the parent's `packageConfig` (if any),
        // forwarded as JSON. On malformed input, log and keep platform defaults.
        try {
            p.config = mergePackageConfig(
                p.config,
                process.env.SOCKETHUB_PLATFORM_CONFIG,
            );
        } catch (err) {
            logger.warn(
                `ignoring invalid SOCKETHUB_PLATFORM_CONFIG: ${errorMessage(
                    err,
                )}`,
            );
        }
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
    function safeProcessSend(message: [string, unknown, unknown?]) {
        if (process.send && process.connected) {
            try {
                process.send(message);
            } catch (ipcErr) {
                console.error(
                    `Failed to report error via IPC: ${errorMessage(ipcErr)}`,
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
                    "@context": buildCanonicalContext(
                        INTERNAL_PLATFORM_CONTEXT_URL,
                    ),
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
     * Persistent platforms hold per-actor connection state, so their jobs
     * must be processed serially. Stateless platforms (feeds, metadata) are
     * shared by every session on the server and their jobs are independent
     * network fetches, so they process in parallel — otherwise one slow
     * fetch stalls the queue for all clients. Overridable per-platform via
     * `packageConfig.concurrency`.
     */
    const DEFAULT_STATELESS_CONCURRENCY = 10;
    function getWorkerConcurrency(): number {
        if (platform.config.persist) {
            return 1;
        }
        const configured = Number(platform.config.concurrency);
        if (Number.isFinite(configured) && configured >= 1) {
            return Math.floor(configured);
        }
        return DEFAULT_STATELESS_CONCURRENCY;
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
     * Handle any uncaught errors from the platform by alerting the worker and
     * shutting down. Sentry sends events asynchronously, so the queued event
     * must be flushed before `process.exit` discards it.
     */
    async function reportFatal(err: Error): Promise<never> {
        console.log("EXCEPTION IN PLATFORM");
        sentry.reportError(err);
        console.log("error:\n", err.stack);
        safeProcessSend(["error", err.toString()]);
        try {
            // A false result means the timeout elapsed with the event still
            // queued. Report it rather than exiting as though it had been
            // delivered, but exit either way: a failing flush must never mask
            // the error being reported.
            if ((await sentry.flush?.()) === false) {
                console.error(
                    `fatal-error-flush timed out for ${platformName} ${identifier}; event may be lost`,
                );
            }
        } catch (flushErr) {
            console.error(
                `fatal-error-flush failed for ${platformName} ${identifier}: ${errorMessage(flushErr)}`,
            );
        }
        process.exit(1);
    }

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
    process.on("message", async (data: MessageFromParent) => {
        if (data[0] === "secrets") {
            const {
                parentSecret2: parentSecret3,
                parentSecret1: parentSecret,
            } = data[1];
            parentSecret1 = parentSecret;
            parentSecret2 = parentSecret3;
            await startQueueListener();
            startHeartbeat();
        } else if (data[0] === "updateActorAck") {
            pendingUpdateActorAck?.resolve();
            pendingUpdateActorAck = undefined;
        } else if (data[0] === "updateActorFailed") {
            const message =
                typeof data[1] === "string" && data[1].length > 0
                    ? data[1]
                    : "actor update rejected by parent";
            pendingUpdateActorAck?.reject(new Error(message));
            pendingUpdateActorAck = undefined;
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
                    { ttlMs: credentialsTtlMs },
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
                        jobLog.error(`failed ${job.title} ${job.msg.type}`);
                        let message: string;
                        // some error objects (e.g. TimeoutError) don't interpolate correctly
                        // to being human-readable, so we have to do this little dance
                        try {
                            message = err.toString();
                        } catch {
                            // toString() failed; fall back to the original error.
                            message = errorMessage(err);
                        }
                        // Platforms mark errors that are expected
                        // operational outcomes rather than server defects —
                        // e.g. metadata scrapes of user-supplied URLs that
                        // time out or get bot-blocked (#1243, #1245). Those
                        // still fail the job (the client sees the error) but
                        // are counted as a metric instead of flooding Sentry
                        // with per-URL error events.
                        if (isExpectedError(err)) {
                            sentry.count?.("platform.job.expected_failure", 1, {
                                platform: platformName,
                                type: job.msg.type,
                            });
                        } else {
                            sentry.reportError(new Error(message));
                        }
                        reject(new Error(message));
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
                        .get(
                            buildCredentialsKey(platformName, job.msg.actor.id),
                            credentialsHash,
                        )
                        .then((credentials) => {
                            credentialsStoreForActorUpdate = credentialStore;
                            actorUpdateSessionId = job.sessionId;
                            actorUpdatePreviousActorId = job.msg.actor.id;
                            // Create wrapper callback that updates credentialsHash after successful call
                            const wrappedCallback: PlatformCallback = (
                                err: Error | null,
                                result: null | ActivityStream,
                            ): void => {
                                clearActorUpdateContext();
                                if (!err && isPersistentPlatform(platform)) {
                                    // Update credentialsHash after successful platform call.
                                    // Only persistent platforms track credential state across requests.
                                    // A nick change already stored the renamed object and set this
                                    // hash; hashing again observes that same object.
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
                                clearActorUpdateContext();
                                doneCallback(
                                    new Error(
                                        `platform method ${job.msg.type} not available`,
                                    ),
                                    null,
                                );
                                return;
                            }
                            try {
                                (
                                    handler as PlatformHandlerWithCredentials
                                ).call(
                                    platform,
                                    job.msg,
                                    credentials,
                                    wrappedCallback,
                                );
                            } catch (err) {
                                clearActorUpdateContext();
                                doneCallback(toError(err), null);
                            }
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
                                // Platform already running - reject job only, preserve platform instance.
                                // This session has failed to prove it holds
                                // credentials for this connection, so it must
                                // also stop receiving the connection's traffic:
                                // rejecting the job alone left it registered
                                // (and subscribed to the fan-out) until the
                                // janitor noticed its socket had gone.
                                safeProcessSend([
                                    "sessionUnauthorized",
                                    null,
                                    job.sessionId,
                                ]);
                                doneCallback(toError(err), null);
                            } else {
                                // Platform not initialized - terminate platform process
                                const error = toError(err);
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
                        const error = toError(err);
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
     * Reject a proposed rename that would overwrite a different account in this
     * session's store. Does not write. The IRC platform calls this before
     * sending NICK, so a collision never changes the nick on the server.
     */
    async function prepareActorUpdate(
        credentials: CredentialsObject,
    ): Promise<void> {
        const store = credentialsStoreForActorUpdate;
        const previousActorId = actorUpdatePreviousActorId;
        if (store && previousActorId) {
            await renameActorCredentialsInStore(
                store,
                platformName,
                previousActorId,
                credentials,
                { dryRun: true },
            );
        }
    }

    /**
     * When a user changes its actor name, the channel identifier changes, we need to ensure that
     * both the queue thread (listening on the channel for jobs) and the logging object are updated.
     * @param credentials
     */
    async function updateActor(credentials: CredentialsObject): Promise<void> {
        // Same scope the parent mixed into the identifier this child was
        // forked with, so both sides derive the same value.
        const nextIdentifier = getPlatformId(
            platformName,
            credentials.actor.id,
            process.env.SOCKETHUB_PLATFORM_SCOPE,
        );
        // Persist the renamed credentials before publishing the new hash or
        // telling the parent the actor moved. A failure leaves Redis, the
        // hash, and the instance key where they were, so the session can
        // still present the pre-rename actor.
        //
        // Use the guarded rename, not `storeActorCredentials`. The latter
        // writes the new actor key unconditionally, and this session may
        // already have a different account there (alice changing nick to bob
        // replaces bob's password; bob's next command then detaches).
        const store = credentialsStoreForActorUpdate;
        const previousActorId = actorUpdatePreviousActorId;
        if (store && previousActorId) {
            await renameActorCredentialsInStore(
                store,
                platformName,
                previousActorId,
                credentials,
            );
        }

        // The actor travels with the new identifier: the parent keys anonymous
        // resumption records and the credential scope on it and has no other
        // way to learn it changed.
        //
        // Not safeProcessSend(): that logs and continues, which would report
        // success while the parent still serves the old actor. On failure,
        // nothing local has moved yet (the credential write above is under
        // the new actor key; the pre-rename key is still intact).
        //
        // Do not restart the queue listener. `queueInstanceId` (and the
        // parent's JobQueue) stay on the identifier this process was forked
        // with. Restarting here used to subscribe the worker to the *new*
        // identifier's queue — which the parent never writes — so every
        // later send, join, or topic sat unconsumed. It also closed the
        // worker while this job's handler was still running.
        await sendUpdateActor(
            credentials,
            nextIdentifier,
            actorUpdateSessionId,
        );
        identifier = nextIdentifier;
        logger.info(
            `platform actor updated to ${credentials.actor.id} identifier ${identifier}`,
        );
        setLoggerContext(`sockethub:platform:${platformName}:${identifier}`);
        logger = createLogger("main");

        if (isPersistentPlatform(platform)) {
            platform.credentialsHash = crypto.objectHash(credentials.object);
        }
    }

    /**
     * Resolves once the parent has migrated peer credentials and re-keyed the
     * instance, and rejects if the IPC channel is gone or the parent rejects
     * the rename.
     */
    function sendUpdateActor(
        credentials: CredentialsObject,
        newIdentifier: string,
        originatingSessionId?: string,
    ): Promise<void> {
        const actorId = credentials.actor?.id;
        if (typeof actorId !== "string" || actorId.length === 0) {
            return Promise.reject(
                new Error("unable to report actor change without an actor id"),
            );
        }
        return new Promise((resolve, reject) => {
            if (!process.send) {
                reject(
                    new Error(
                        "unable to report actor change: no IPC channel to parent",
                    ),
                );
                return;
            }
            if (pendingUpdateActorAck) {
                reject(
                    new Error(
                        "actor update already in flight; cannot report another change",
                    ),
                );
                return;
            }
            pendingUpdateActorAck = {
                resolve,
                reject,
            };
            process.send(
                [
                    "updateActor",
                    actorId,
                    newIdentifier,
                    credentials,
                    originatingSessionId,
                ],
                (err: Error | null) => {
                    if (err) {
                        pendingUpdateActorAck = undefined;
                        reject(err);
                    }
                },
            );
        });
    }

    /**
     * Starts listening on the queue for incoming jobs.
     *
     * @param refresh replace the current worker. The queue name stays the one
     * captured on the first start (`queueInstanceId`), even if `identifier`
     * has since changed for an actor rename.
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
        const concurrency = getWorkerConcurrency();
        jobWorker = new JobWorker(
            parentId,
            queueInstanceId,
            parentSecret1 + parentSecret2,
            { url: redisUrl },
            { concurrency },
        );
        logger.info(
            `listening on the queue for incoming jobs (concurrency: ${concurrency})`,
        );
        jobWorker.onJob(getJobHandler());
        jobWorkerStarted = true;
    }
}

if (process.env.SOCKETHUB_PLATFORM_CHILD === "1") {
    void startPlatformProcess();
}
