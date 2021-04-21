import Store from 'secure-store-redis';

import config from "./config";
import crypto from "./crypto";

export interface Store {
  save(id: string, obj: any, cb: Function);
  get(id: string, cb: Function);
}

export function getSessionStore(parentId: string, parentSecret: string,
                                sessionId: string, sessionSecret: string): Store {
  return new Store({
    namespace: 'sockethub:' + parentId + ':session:' + sessionId + ':store',
    secret: parentSecret + sessionSecret,
    redis: config.get('redis')
  });
}

export function getPlatformId(platform: string, actor?: string): string {
  return actor ? crypto.hash(platform + actor) : crypto.hash(platform);
}