/**
 * responsible for handling the validation and expansion (when applicable) of all incoming objects
 */

import { createLogger } from "@sockethub/logger";
import {
    type ActivityObject,
    type ActivityStream,
    AS2_BASE_CONTEXT_URL,
    resolvePlatformId,
    SOCKETHUB_BASE_CONTEXT_URL,
    validateActivityObject,
    validateActivityStream,
    validateCredentials,
} from "@sockethub/schemas";

import getInitObject, { type IInitObject } from "../bootstrap/init.js";
import type { MiddlewareChainInterface } from "../middleware.js";

// called when registered with the middleware function, define the type of validation
// that will be called when the middleware eventually does.
export default function validate<T extends ActivityObject>(
    type: "activity-object",
    sockethubId: string,
    passedInitObj?: IInitObject,
): (msg: T, done: MiddlewareChainInterface<T>) => void;
export default function validate<T extends ActivityStream>(
    type: "credentials" | "message",
    sockethubId: string,
    passedInitObj?: IInitObject,
): (msg: T, done: MiddlewareChainInterface<T>) => void;
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
    if (!passedInitObj) {
        getInitObject().then((init) => {
            initObj = init;
        });
    }

    const sessionLog = createLogger(
        `server:middleware:validate:${sockethubId}`,
    );
    return (
        msg: ActivityStream | ActivityObject,
        done: MiddlewareChainInterface<ActivityStream | ActivityObject>,
    ) => {
        sessionLog.debug(`applying schema validation for ${type}`);
        if (type === "activity-object") {
            const err = validateActivityObject(msg as ActivityObject);
            if (err) {
                done(new Error(err));
            } else {
                done(msg);
            }
        } else {
            if (!initObj) {
                return done(
                    new Error(
                        "Sockethub platforms not initialized for validation.",
                    ),
                );
            }
            const stream = msg as ActivityStream;
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
            if (!initObj.platforms.has(platformId)) {
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
                    const platformMeta = initObj.platforms.get(platformId);
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
        }
    };
}
