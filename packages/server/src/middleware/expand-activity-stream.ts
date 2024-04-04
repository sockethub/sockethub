import ASFactory, { ASFactoryOptions } from "@sockethub/activity-streams";
import { ActivityStream } from "@sockethub/schemas";

import config from "../config";
import { MiddlewareChainInterface } from "../middleware";

const asConfig = config.get("activity-streams:opts") as ASFactoryOptions;
asConfig.warnOnUnknownObjectProperties = false;
asConfig.failOnUnknownObjectProperties = false;

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const activity = ASFactory.default(asConfig);

function ensureObject(msg: unknown) {
    return !(typeof msg !== "object" || Array.isArray(msg));
}

export default function expandActivityStream(
    msg: ActivityStream,
    done: MiddlewareChainInterface,
) {
    if (!ensureObject(msg)) {
        done(new Error(`message received is not an object.`));
    } else if (typeof msg.context !== "string") {
        done(new Error("activity stream must contain a context property"));
    } else if (typeof msg.type !== "string") {
        done(new Error("activity stream must contain a type property."));
    } else {
        msg = activity.Stream(msg) as ActivityStream;
        if (!msg.actor) {
            done(new Error("activity stream must contain an actor property."));
        } else {
            done(msg);
        }
    }
}
