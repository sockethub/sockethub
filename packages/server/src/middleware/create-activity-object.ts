import ActivityStreams from '@sockethub/activity-streams';
import config from "../config";
import {IActivityStream} from "@sockethub/schemas";
const activity = ActivityStreams(config.get('activity-streams:opts'));

/**
 * A simple middleware wrapper for the activity-streams Object.create method.
 * @param obj
 */
export default async function createActivityObject(obj: IActivityStream) {
  activity.Object.create(obj);
  return obj;
}
