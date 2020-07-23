import Store from 'secure-store-redis';

import config from "./config";
import crypto from "./crypto";

export function getSessionStore(parentId: string, parentSecret: string,
                                sessionId: string, sessionSecret: string) {
  return new Store({
    namespace: 'sockethub:' + parentId + ':session:' + sessionId + ':store',
    secret: parentSecret + sessionSecret,
    redis: config.get('redis')
  });
}

export function getPlatformId(platform: string, actor?: string) {
  return actor ? crypto.hash(platform + actor) : crypto.hash(platform);
}