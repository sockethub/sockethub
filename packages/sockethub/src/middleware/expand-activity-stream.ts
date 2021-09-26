import ActivityStreams from 'activity-streams';

import config from "../config";
import {ActivityObject} from "../sockethub";

const activity = ActivityStreams(config.get('activity-streams:opts'));

function ensureObject(msg: any) {
  return !((typeof msg !== 'object') || (Array.isArray(msg)));
}

export default function expandActivityStream(msg: ActivityObject, done: Function) {
  if (! ensureObject(msg)) {
    done(new Error(`message received is not an object.`));
  } else if (typeof msg.context !== 'string') {
    done(new Error('activity stream must contain a context property'));
  }  else if (typeof msg.type !== 'string') {
    done(new Error('activity stream must contain a type property.'));
  } else {
    msg = activity.Stream(msg);
    if (! msg.actor) {
      done(new Error('activity stream must contain an actor property.'));
    } else {
      done(msg);
    }
  }
}