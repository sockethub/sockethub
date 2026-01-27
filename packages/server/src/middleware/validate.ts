/**
 * responsible for handling the validation and expansion (when applicable) of all incoming objects
 */

import { createLogger } from "@sockethub/logger";
import {
    type ActivityStream,
    type MiddlewareCallback,
    validateActivityObject,
    validateActivityStream,
    validateCredentials,
} from "@sockethub/schemas";

import getInitObject, { type IInitObject } from "../bootstrap/init.js";

// called when registered with the middleware function, define the type of validation
// that will be called when the middleware eventually does.
export default function validate(
    type: string,
    sockethubId: string,
    passedInitObj?: IInitObject,
) {
    let initObj = passedInitObj;
    if (!passedInitObj) {
        getInitObject().then((init) => {
            initObj = init;
        });
    }

    const sessionLog = createLogger({
        namespace: `sockethub:server:validate:${sockethubId}`,
    });
    return (msg: ActivityStream, done: MiddlewareCallback) => {
        sessionLog.debug(`applying schema validation for ${type}`);
        if (type === "activity-object") {
            const err = validateActivityObject(msg);
            if (err) {
                done(new Error(err));
            } else {
                done(msg);
            }
        } else if (!initObj.platforms.has(msg.context)) {
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
                const platformMeta = initObj.platforms.get(msg.context);
                if (!platformMeta.types.includes(msg.type)) {
                    return done(
                        new Error(
                            `platform type ${msg.type} not supported by ${msg.context} ` +
                                `platform. (types: ${platformMeta.types.join(
                                    ", ",
                                )})`,
                        ),
                    );
                }
                done(msg);
            }
        }
    };
}
