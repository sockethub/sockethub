import ASFactory from 'activity-streams';
import {ActivityObject} from "../sockethub";
import config from "../config";
const activity: ASManager = ASFactory(config.get('activity-streams:opts'));

export interface ActivityObjectManager {
  create(obj: ActivityObject): ActivityObject;
  delete(id: string): boolean;
  list(): Array<string>,
  get(id: string, expand: boolean): ActivityObject;
}

export interface ASManager {
  Stream(meta: any): ActivityObject,
  Object: ActivityObjectManager,
  on(event, func): void;
  once(event, func): void;
  off(event, funcName): void;
}

/**
 * A simple middleware wrapper for the activity-streams Object.create method.
 * @param obj
 * @param done
 */
export default function createActivityObject(obj: ActivityObject, done: Function) {
  activity.Object.create(obj);
  done(obj);
}