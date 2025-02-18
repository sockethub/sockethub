import { ASFactory } from "@sockethub/activity-streams";
import type { ActivityObject } from "@sockethub/schemas";

import config from "../config.js";
import type { MiddlewareChainInterface } from "../middleware.js";

const activity = ASFactory(
    config.get("packageConfig:@sockethub/activity-streams"),
);

/**
 * A simple middleware wrapper for the activity-streams `Object.create` method.
 * @param obj
 * @param done
 */
export default function createActivityObject(
    obj: ActivityObject,
    done: MiddlewareChainInterface,
) {
    activity.Object.create(obj);
    done(obj);
}
