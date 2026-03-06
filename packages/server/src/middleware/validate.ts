/**
 * responsible for handling the validation and expansion (when applicable) of all incoming objects
 */

import { createLogger } from "@sockethub/logger";
import {
    type ActivityObject,
    type ActivityStream,
    buildCanonicalContext,
    resolvePlatformId,
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
    const getLegacyContext = (stream: ActivityStream): string | undefined => {
        const legacyContext = (stream as ActivityStream & { context?: unknown })
            .context;
        return typeof legacyContext === "string" ? legacyContext : undefined;
    };

    const normalizeLegacyContext = (
        stream: ActivityStream,
        initObj: IInitObject,
    ) => {
        if (Array.isArray(stream["@context"])) {
            return;
        }
        const legacyContext = getLegacyContext(stream);
        if (!legacyContext) {
            return;
        }
        const platformMeta = initObj.platforms.get(legacyContext);
        if (!platformMeta?.contextUrl) {
            return;
        }
        stream["@context"] = buildCanonicalContext(platformMeta.contextUrl);
        stream.platform = legacyContext;
    };

    let initObj = passedInitObj;
    if (!passedInitObj) {
        getInitObject().then((init) => {
            initObj = init;
        });
    }

    const sessionLog = createLogger(`server:validate:${sockethubId}`);
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
            normalizeLegacyContext(stream, initObj);
            const platformId = resolvePlatformId(stream);
            if (!platformId) {
                return done(
                    new Error(
                        "platform context URL not registered with this Sockethub instance.",
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
            stream.platform = platformId;
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
