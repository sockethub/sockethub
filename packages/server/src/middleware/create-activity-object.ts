import ActivityStreams from '@sockethub/activity-streams';
import config from "../config";
const activity = ActivityStreams(config.get('activity-streams:opts'));

/**
 * A simple middleware wrapper for the activity-streams Object.create method.
 * @param obj
 * @param done
 */
export default function createActivityObject(obj: any, done: Function) {
  activity.Object.create(obj);
  done(obj);
}