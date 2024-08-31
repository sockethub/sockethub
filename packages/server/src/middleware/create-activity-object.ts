import ActivityStreams, { type ASFactoryOptions } from "@sockethub/activity-streams";
import config from "./../config.ts";
import type { ActivityStream } from "@sockethub/schemas";
import type { MiddlewareChainInterface } from "./../middleware.ts";
const activity = ActivityStreams(config.get("activity-streams:opts") as ASFactoryOptions);

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
