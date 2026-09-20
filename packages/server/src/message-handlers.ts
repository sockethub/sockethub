/**
 * Shared handler pipelines for socket and HTTP request paths.
 *
 * Keeps validation, credentials storage, and queueing logic identical so
 * both transports behave the same.
 */
import type { CredentialsStoreInterface } from "@sockethub/data-layer";
import type {
    ActivityStream,
    InternalActivityStream,
} from "@sockethub/schemas";
import { resolvePlatformId } from "@sockethub/schemas";
import { errorMessage } from "@sockethub/util/error";
import normalizeActivityStreamMiddleware from "./middleware/normalize-activity-stream.js";
import storeCredentials from "./middleware/store-credentials.js";
import validate from "./middleware/validate.js";
import middleware from "./middleware.js";
import { observability } from "./observability.js";
import type PlatformInstance from "./platform-instance.js";
import type ProcessManager from "./process-manager.js";

export type MessageHandler<T> = (
    data: T,
    callback: (data?: T | Error) => void,
) => void;

export interface MessageHandlers {
    credentials: MessageHandler<ActivityStream>;
    message: MessageHandler<InternalActivityStream>;
}

export interface MessageHandlersOptions {
    processManager: ProcessManager;
    sessionId: string;
    sessionSecret: string;
    credentialsStore: CredentialsStoreInterface;
    clientIp?: string;
    // Socket path uses this to preserve existing ProcessManager session behavior.
    platformSessionId?: string;
    onPlatformInstance?: (platformInstance: PlatformInstance) => void;
    /** Bounded telemetry dimension identifying the public request path. */
    transport?: "socket" | "http";
    /** Called only after platform and action labels pass schema validation. */
    onPlatformAction?: (platform: string, action: string) => void;
}

/**
 * Normalize middleware errors into payload-safe error responses.
 * Removes internal-only properties that must never be sent to clients.
 */
export function attachError<T extends ActivityStream>(err: unknown, msg?: T) {
    const message = errorMessage(err);
    if (!msg) {
        return new Error(message);
    }

    const cleaned = { ...msg, error: message } as T & {
        sessionSecret?: string;
    };
    if ("sessionSecret" in cleaned) {
        delete cleaned.sessionSecret;
    }
    return cleaned;
}

export function createMessageHandlers(
    options: MessageHandlersOptions,
): MessageHandlers {
    const {
        processManager,
        sessionId,
        sessionSecret,
        credentialsStore,
        clientIp,
        platformSessionId,
        onPlatformInstance,
        transport = "socket",
        onPlatformAction,
    } = options;

    // Shared handler chain for credentials across socket + HTTP paths.
    const credentials = middleware<ActivityStream>("credentials")
        .use(normalizeActivityStreamMiddleware)
        .use(validate<ActivityStream>("credentials", sessionId))
        .use(storeCredentials(credentialsStore, sessionId))
        .use(
            (
                data: ActivityStream,
                next: (data?: ActivityStream | Error) => void,
            ) => {
                // This runs only after normalization, schema validation, and
                // successful credential storage, so labels are trusted.
                const platform = resolvePlatformId(data) ?? "unknown";
                onPlatformAction?.(platform, "credentials");
                observability.startAction(platform, "credentials", {
                    transport,
                })();
                next(data);
            },
        )
        .use(
            (
                err: Error,
                data: ActivityStream,
                next: (data?: ActivityStream | Error) => void,
            ) => {
                // error handler
                next(attachError(err, data));
            },
        )
        .use(
            (
                data: ActivityStream,
                next: (data?: ActivityStream | Error) => void,
            ) => {
                next(data);
            },
        )
        .done();

    // Shared handler chain for message processing across socket + HTTP paths.
    const message = middleware<InternalActivityStream>("message")
        .use(normalizeActivityStreamMiddleware)
        .use(validate<InternalActivityStream>("message", sessionId))
        .use(
            (
                msg: InternalActivityStream,
                next: (data?: InternalActivityStream | Error) => void,
            ) => {
                // The platform thread must find the credentials on their own using the given
                // sessionSecret, which indicates that this specific session (socket
                // connection) has provided credentials.
                msg.sessionSecret = sessionSecret;
                next(msg);
            },
        )
        .use(
            (
                err: Error,
                data: InternalActivityStream,
                next: (data?: InternalActivityStream | Error) => void,
            ) => {
                next(attachError(err, data));
            },
        )
        .use(
            async (
                msg: ActivityStream,
                next: (data?: ActivityStream | Error) => void,
            ) => {
                const platformId = resolvePlatformId(msg);
                if (!platformId) {
                    next(
                        attachError(
                            "unable to resolve platform from @context",
                            msg,
                        ),
                    );
                    return;
                }
                // This middleware runs after AJV validation. Using platform
                // and action as telemetry labels is safe only from here on.
                onPlatformAction?.(platformId, msg.type);
                const finish = observability.startAction(platformId, msg.type, {
                    transport,
                });
                let platformInstance: Awaited<
                    ReturnType<ProcessManager["get"]>
                >;
                try {
                    platformInstance = await processManager.get(
                        platformId,
                        msg.actor.id,
                        platformSessionId,
                        clientIp,
                        // Credentials are registered under this session, which
                        // over HTTP is not the same as platformSessionId.
                        sessionId,
                    );
                } catch (err) {
                    // e.g. limits.maxPlatformInstances reached
                    finish(true);
                    next(attachError(err, msg));
                    return;
                }
                if (onPlatformInstance) {
                    onPlatformInstance(platformInstance);
                }
                // job validated and queued, stores the callback for when the job completes
                try {
                    const job = await platformInstance.queue.add(
                        sessionId,
                        msg,
                    );
                    if (job) {
                        platformInstance.registerCompletedJobHandler(
                            job.title,
                            (result) => {
                                const failed =
                                    result instanceof Error ||
                                    (typeof result === "object" &&
                                        result !== null &&
                                        "error" in result);
                                finish(failed);
                                next(result);
                            },
                        );
                    } else {
                        // failed to add job to queue, reject handler immediately
                        finish(true);
                        next(attachError("failed to add job to queue", msg));
                    }
                } catch (err) {
                    // Queue is closed (platform terminating) - send error to client
                    finish(true);
                    next(attachError(err, msg));
                }
            },
        )
        .done();

    return {
        credentials,
        message,
    };
}
