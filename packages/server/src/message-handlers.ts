/**
 * Shared handler pipelines for socket and HTTP request paths.
 *
 * Keeps validation, credentials storage, and queueing logic identical so
 * both transports behave the same.
 */
import type { CredentialsStoreInterface } from "@sockethub/data-layer";
import type {
    ActivityObject,
    ActivityStream,
    InternalActivityStream,
} from "@sockethub/schemas";
import createActivityObject from "./middleware/create-activity-object.js";
import expandActivityStream from "./middleware/expand-activity-stream.js";
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
    activityObject: MessageHandler<ActivityObject>;
    message: MessageHandler<InternalActivityStream>;
}

export interface MessageHandlersOptions {
    processManager: ProcessManager;
    sessionId: string;
    sessionSecret: string;
    credentialsStore: CredentialsStoreInterface;
    // Socket path uses this to preserve existing ProcessManager session behavior.
    platformSessionId?: string;
    onPlatformInstance?: (platformInstance: PlatformInstance) => void;
}

export function attachError<T extends ActivityStream | ActivityObject>(
    err: unknown,
    msg?: T,
) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (!msg) {
        return new Error(errorMessage);
    }

    const cleaned = { ...msg, error: errorMessage } as T & {
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
        platformSessionId,
        onPlatformInstance,
    } = options;

    // Shared handler chain for credentials across socket + HTTP paths.
    const credentials = middleware<ActivityStream>("credentials")
        .use(expandActivityStream)
        .use(validate<ActivityStream>("credentials", sessionId))
        .use(storeCredentials(credentialsStore))
        .use(
            (
                err: Error,
                data: ActivityStream,
                next: (data?: ActivityStream | Error) => void,
            ) => {
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

    // Shared handler chain for activity-object across socket + HTTP paths.
    const activityObject = middleware<ActivityObject>("activity-object")
        .use(validate<ActivityObject>("activity-object", sessionId))
        .use(createActivityObject)
        .use(
            (
                err: Error,
                data: ActivityObject,
                next: (data?: ActivityObject | Error) => void,
            ) => {
                next(attachError(err, data));
            },
        )
        .use(
            (
                data: ActivityObject,
                next: (data?: ActivityObject | Error) => void,
            ) => {
                next(data);
            },
        )
        .done();

    // Shared handler chain for message processing across socket + HTTP paths.
    const message = middleware<InternalActivityStream>("message")
        .use(expandActivityStream)
        .use(validate<InternalActivityStream>("message", sessionId))
        .use(
            (
                msg: InternalActivityStream,
                next: (data?: InternalActivityStream | Error) => void,
            ) => {
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
                // Queue the job; the callback will be invoked when the job completes.
                const platformInstance = processManager.get(
                    msg.context,
                    msg.actor.id,
                    platformSessionId,
                );
                if (onPlatformInstance) {
                    onPlatformInstance(platformInstance);
                }
                try {
                    const job = await platformInstance.queue.add(
                        sessionId,
                        msg,
                    );
                    if (job) {
                        platformInstance.completedJobHandlers.set(
                            job.title,
                            next,
                        );
                    } else {
                        msg.error = "failed to add job to queue";
                        next(msg);
                    }
                } catch (err) {
                    const errorMessage =
                        err instanceof Error ? err.message : String(err);
                    msg.error = errorMessage || "platform unavailable";
                    next(msg);
                }
            },
        )
        .done();

    return {
        credentials,
        activityObject,
        message,
    };
}
