import { ASFactory, type ASFactoryOptions } from "@sockethub/activity-streams";
import type { ActivityStream } from "@sockethub/schemas";

import config from "../config.js";
import type { MiddlewareChainInterface } from "../middleware.js";

const asConfig = config.get(
    "packageConfig:@sockethub/activity-streams",
) as ASFactoryOptions;
asConfig.warnOnUnknownObjectProperties = false;
asConfig.failOnUnknownObjectProperties = false;

const activity = ASFactory(asConfig);

function ensureObject(msg: unknown) {
    return !(typeof msg !== "object" || Array.isArray(msg));
}

export default function expandActivityStream<T extends ActivityStream>(
    msg: T,
    done: MiddlewareChainInterface<T>,
) {
    if (!ensureObject(msg)) {
        done(new Error("message received is not an object."));
    } else if (typeof msg.context !== "string") {
        done(new Error("activity stream must contain a context property"));
    } else if (typeof msg.type !== "string") {
        done(new Error("activity stream must contain a type property."));
    } else {
        const msgStream = activity.Stream(msg) as T;
        if (!msgStream.actor) {
            done(new Error("activity stream must contain an actor property."));
        } else {
            done(msgStream);
        }
    }
}
