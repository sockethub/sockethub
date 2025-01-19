import { ASFactory } from "@sockethub/activity-streams";
import { ActivityStream } from "@sockethub/schemas";

import config from "../config.js";
import { MiddlewareChainInterface } from "../middleware.js";

const activity = ASFactory(config.get("activity-streams:opts"));

/**
 * A simple middleware wrapper for the activity-streams Object.create method.
 * @param obj
 * @param done
 */
export default function createActivityObject(
    obj: ActivityStream,
    done: MiddlewareChainInterface,
) {
    activity.Object.create(obj);
    done(obj);
}
