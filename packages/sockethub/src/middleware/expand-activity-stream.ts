import ActivityStreams from 'activity-streams';
import URI from 'urijs';

import config from "../config";
import {ActivityObject} from "../sockethub";
import init from "../bootstrap/init";

const activity = ActivityStreams(config.get('activity-streams:opts'));

function ensureDisplayName(msg: any) {
  if ((msg['@id']) && (! msg.displayName)) {
    const uri = new URI(msg['@id']);
    return uri.username() || getUriFragment(uri) || uri.path();
  }
  return msg.displayName;
}

function ensureObject(msg: any) {
  return !((typeof msg !== 'object') || (Array.isArray(msg)));
}

function getUriFragment(uri: any) {
  const frag = uri.fragment();
  return (frag) ? '#' + frag : undefined;
}

function expandProp(propName, prop) {
  return (typeof prop === 'string') ? activity.Object.get(prop, true) : prop;
}

function expandStream(msg) {
  msg.actor.displayName = ensureDisplayName(msg.actor);
  if (msg.target) {
    msg.target.displayName = ensureDisplayName(msg.target);
  }
  return msg;
}

export default function expandActivityStream(msg: ActivityObject, done: Function) {
  if (! ensureObject(msg)) {
    return done(new Error(`message received is not an object.`));
  } else if (typeof msg.context !== 'string') {
    return done(new Error('activity stream must contain a context property'));
  } else if (! init.platforms.has(msg.context)) {
    return done(
      new Error(`platform context ${msg.context} not registered with this sockethub instance.`)
    );
  } else if (typeof msg['@type'] !== 'string') {
    return done(new Error('activity stream must contain a @type property.'));
  }
  msg = activity.Stream(msg);
  if (! msg.actor) {
    return done(new Error('activity stream must contain an actor property.'));
  }
  // msg = expandStream(msg);
  // msg.actor = expandProp('actor', msg.actor);
  // msg.target = expandProp('target', msg.target);
  done(msg);
}