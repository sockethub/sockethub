import ASFactory from "@sockethub/activity-streams";
import config from "../config";
import { ActivityStream } from "@sockethub/schemas";
import { MiddlewareChainInterface } from "../middleware";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const activity = ASFactory.default(config.get("activity-streams:opts"));

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
