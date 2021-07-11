import SecureStore from 'secure-store-redis';

import config from "./config";
import crypto from "./crypto";

export interface ISecureStoreInstance {
  save(id: string, obj: any, cb: Function);
  get(id: string, cb: Function);
}

export function getSessionStore(parentId: string, parentSecret: string,
                                sessionId: string, sessionSecret: string,
                                StoreObject: SecureStore = SecureStore): ISecureStoreInstance {
  return new StoreObject({
    namespace: 'sockethub:' + parentId + ':session:' + sessionId + ':store',
    secret: parentSecret + sessionSecret,
    redis: config.get('redis')
  });
}

export function getPlatformId(platform: string, actor?: string): string {
  return actor ? crypto.hash(platform + actor) : crypto.hash(platform);
}