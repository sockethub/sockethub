/**
 * responsible for handling the validation and expansion (when applicable) of all incoming objects
 */

import { createLogger } from "@sockethub/logger";
import {
    type ActivityStream,
    AS2_BASE_CONTEXT_URL,
    resolvePlatformId,
    SOCKETHUB_BASE_CONTEXT_URL,
    validateActivityStream,
    validateCredentials,
} from "@sockethub/schemas";

import getInitObject, { type IInitObject } from "../bootstrap/init.js";
import type {
    MiddlewareChainInterface,
    MiddlewareHandler,
} from "../middleware.js";

// called when registered with the middleware function, define the type of validation
// that will be called when the middleware eventually does.
export default function validate<T extends ActivityStream>(
    type: "credentials" | "message",
    sockethubId: string,
    passedInitObj?: IInitObject,
): MiddlewareHandler<T>;
export default function validate(
    type: string,
    sockethubId: string,
    passedInitObj?: IInitObject,
) {
    const baseContextUrls = new Set([
        AS2_BASE_CONTEXT_URL,
        SOCKETHUB_BASE_CONTEXT_URL,
    ]);

    const getPlatformContextCandidates = (
        stream: ActivityStream,
    ): Array<string> => {
        if (!Array.isArray(stream["@context"])) {
            return [];
        }
        return stream["@context"].filter(
            (value): value is string =>
                typeof value === "string" && !baseContextUrls.has(value),
        );
    };

    let initObj = passedInitObj;

    const sessionLog = createLogger(
        `server:middleware:validate:${sockethubId}`,
    );

    const runValidation = (
        ready: IInitObject,
        stream: ActivityStream,
        done: MiddlewareChainInterface<ActivityStream>,
    ) => {
        const platformId = resolvePlatformId(stream);
        if (!platformId) {
            const platformContextCandidates =
                getPlatformContextCandidates(stream);
            const contextDetails =
                platformContextCandidates.length === 0
                    ? " No platform @context values were provided."
                    : platformContextCandidates.length > 1
                      ? ` Multiple platform @context values were provided: ${platformContextCandidates.join(", ")}.`
                      : ` Unregistered platform @context value: ${platformContextCandidates[0]}`;
            return done(
                new Error(
                    `platform context URL not registered with this Sockethub instance.${contextDetails}`,
                ),
            );
        }
        if (!ready.platforms.has(platformId)) {
            return done(
                new Error(
                    `platform ${platformId} resolved from @context is not enabled in this Sockethub instance.`,
                ),
            );
        }
        if (type === "credentials") {
            const err = validateCredentials(stream);
            if (err) {
                done(new Error(err));
            } else {
                done(stream);
            }
        } else {
            const err = validateActivityStream(stream);
            if (err) {
                done(new Error(err));
            } else {
                const platformMeta = ready.platforms.get(platformId);
                if (!platformMeta) {
                    return done(
                        new Error(
                            `platform ${platformId} not registered with this Sockethub instance.`,
                        ),
                    );
                }
                if (!platformMeta.types.includes(stream.type)) {
                    return done(
                        new Error(
                            `platform type ${stream.type} not supported by ${platformId} ` +
                                `platform. (types: ${platformMeta.types.join(
                                    ", ",
                                )})`,
                        ),
                    );
                }
                done(stream);
            }
        }
    };

    return (
        stream: ActivityStream,
        done: MiddlewareChainInterface<ActivityStream>,
    ) => {
        sessionLog.debug(`applying schema validation for ${type}`);
        // Fast path: init already resolved. In production init is awaited before
        // connections are accepted (sockethub.ts), and it is cached after the
        // first resolve.
        if (initObj) {
            return runValidation(initObj, stream, done);
        }
        // Init not yet resolved (e.g. a message arriving during startup): resolve
        // the memoized init promise rather than rejecting the message.
        getInitObject().then(
            (resolved) => {
                initObj = resolved;
                runValidation(resolved, stream, done);
            },
            () =>
                done(
                    new Error(
                        "Sockethub platforms not initialized for validation.",
                    ),
                ),
        );
    };
}
