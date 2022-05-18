import ActivityStreams from '@sockethub/activity-streams';
import { IActivityStream } from "@sockethub/schemas";

import config from "../config";
import {MiddlewareChainInterface} from "../middleware";

const activity = ActivityStreams(config.get('activity-streams:opts'));

function ensureObject(msg: unknown) {
  return !((typeof msg !== 'object') || (Array.isArray(msg)));
}

export default function expandActivityStream(msg: IActivityStream,
                                             done: MiddlewareChainInterface) {
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
