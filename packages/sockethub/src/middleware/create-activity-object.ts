import ActivityStreams from 'activity-streams';
import {ActivityObject} from "../sockethub";
import config from "../config";
const activity = ActivityStreams(config.get('activity-streams:opts'));

export default function createActivityObject(obj: ActivityObject, done: Function) {
  activity.Object.create(obj);
  done(obj);
}