import ASFactory, {ASFactoryOptions} from "@sockethub/activity-streams";
import {IActivityStream} from "@sockethub/schemas";

import config from "../config";
import {MiddlewareChainInterface} from "../middleware";

const asConfig = config.get('activity-streams:opts') as ASFactoryOptions;
asConfig.warnOnUnknownObjectProperties = false;
asConfig.failOnUnknownObjectProperties = false;
const activity = ASFactory(asConfig);

function ensureObject(msg: unknown) {
  return !((typeof msg !== 'object') || (Array.isArray(msg)));
}

export default function expandActivityStream(
  msg: IActivityStream,
  done: MiddlewareChainInterface
) {
  if (! ensureObject(msg)) {
    done(new Error(`message received is not an object.`));
  } else if (typeof msg.context !== 'string') {
    done(new Error('activity stream must contain a context property'));
  } else if (typeof msg.type !== 'string') {
    done(new Error('activity stream must contain a type property.'));
  } else {
    msg = activity.Stream(msg) as IActivityStream;
    if (!msg.actor) {
      done(new Error('activity stream must contain an actor property.'));
    } else {
      done(msg);
    }
  }
}
