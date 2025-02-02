/**
 * responsible for handling the validation and expansion (when applicable) of all incoming objects
 */
import debug from "debug";

import {
    addPlatformSchema,
    validateActivityObject,
    validateCredentials,
    validateActivityStream,
    ActivityStream,
    MiddlewareCallback,
} from "@sockethub/schemas";

import getInitObject from "../bootstrap/init.js";

let initObj;
(async function () {
    initObj = await getInitObject();
    await registerPlatforms(initObj);
})();

export async function registerPlatforms(init) {
    init.platforms.forEach((platform) => {
        Object.keys(platform.schemas).forEach((key) => {
            if (!platform.schemas[key]) {
                return;
            }
            addPlatformSchema(platform.schemas[key], `${platform.id}/${key}`);
        });
    });
}

// called when registered with the middleware function, define the type of validation
// that will be called when the middleware eventually does.
export default function validate(
    type: string,
    sockethubId: string,
    init = initObj,
) {
    const sessionLog = debug(`sockethub:server:validate:${sockethubId}`);
    return (msg: ActivityStream, done: MiddlewareCallback) => {
        sessionLog("applying schema validation for " + type);
        if (type === "activity-object") {
            const err = validateActivityObject(msg);
            if (err) {
                done(new Error(err));
            } else {
                done(msg);
            }
        } else if (!init.platforms.has(msg.context)) {
            return done(
                new Error(
                    `platform context ${msg.context} not registered with this Sockethub instance.`,
                ),
            );
        } else if (type === "credentials") {
            const err = validateCredentials(msg);
            if (err) {
                done(new Error(err));
            } else {
                done(msg);
            }
        } else {
            const err = validateActivityStream(msg);
            if (err) {
                done(new Error(err));
            } else {
                const platformMeta = init.platforms.get(msg.context);
                if (!platformMeta.types.includes(msg.type)) {
                    return done(
                        new Error(
                            `platform type ${msg.type} not supported by ${msg.context} ` +
                                `platform. (types: ${platformMeta.types.join(
                                    ", ",
                                )})`,
                        ),
                    );
                } else {
                    done(msg);
                }
            }
        }
    };
}
