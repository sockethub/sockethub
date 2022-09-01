import ActivityStreams from '@sockethub/activity-streams';
import {IActivityStream} from "@sockethub/schemas";

import config, {ActivityStreamConfigOptions} from "../config";

const asConfig = config.get('activity-streams:opts') as ActivityStreamConfigOptions;
asConfig.warnOnUnknownObjectProperties = false;
asConfig.failOnUnknownObjectProperties = false;
const activity = ActivityStreams(asConfig);

function ensureObject(msg: unknown) {
  return !((typeof msg !== 'object') || (Array.isArray(msg)));
}

/**
 * @param msg
 */
export default async function expandActivityStream(msg: IActivityStream) {
  if (! ensureObject(msg)) {
    throw new Error(`message received is not an object.`);
  } else if (typeof msg.context !== 'string') {
    throw new Error('activity stream must contain a context property');
  } else if (typeof msg.type !== 'string') {
    throw new Error('activity stream must contain a type property.');
  } else {
    msg = activity.Stream(msg);
    if (!msg.actor) {
      throw new Error('activity stream must contain an actor property.');
    }
  }
  return msg;
}
