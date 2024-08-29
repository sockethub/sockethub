import ActivityStreams from "@sockethub/activity-streams";
import config from "../config";
import { ActivityStream } from "@sockethub/schemas";
import { MiddlewareChainInterface } from "../middleware";
const activity = ActivityStreams(config.get("activity-streams:opts"));

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
