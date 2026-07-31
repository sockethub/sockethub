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
import credentialCheck from "./middleware/credential-check.js";
import normalizeActivityStreamMiddleware from "./middleware/normalize-activity-stream.js";
import storeCredentials from "./middleware/store-credentials.js";
import validate from "./middleware/validate.js";
import middleware from "./middleware.js";
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
    isSessionActive?: (sessionId: string) => boolean;
    // Socket path uses this to preserve existing ProcessManager session behavior.
    platformSessionId?: string;
    onPlatformInstance?: (platformInstance: PlatformInstance) => void;
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
        isSessionActive,
        platformSessionId,
        onPlatformInstance,
    } = options;

    // Shared handler chain for credentials across socket + HTTP paths.
    const credentials = middleware<ActivityStream>("credentials")
        .use(normalizeActivityStreamMiddleware)
        .use(validate<ActivityStream>("credentials", sessionId))
        .use(storeCredentials(credentialsStore))
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
            credentialCheck(
                credentialsStore,
                sessionId,
                clientIp ?? "",
                isSessionActive,
            ),
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
                let platformInstance: Awaited<
                    ReturnType<ProcessManager["get"]>
                >;
                try {
                    platformInstance = await processManager.get(
                        platformId,
                        msg.actor.id,
                        platformSessionId,
                        clientIp,
                    );
                } catch (err) {
                    // e.g. limits.maxPlatformInstances reached
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
                            next,
                        );
                    } else {
                        // failed to add job to queue, reject handler immediately
                        next(attachError("failed to add job to queue", msg));
                    }
                } catch (err) {
                    // Queue is closed (platform terminating) - send error to client
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
