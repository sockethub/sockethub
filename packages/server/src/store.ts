import SecureStore from 'secure-store-redis';

import config from "./config";

export interface ISecureStoreInstance {
  save(id: string, obj: any, cb: Function);
  get(id: string, cb: Function);
}

export function getSessionStore(parentId: string, parentSecret: string,
                                sessionId: string, sessionSecret: string): ISecureStoreInstance {
  return new SecureStore({
    namespace: 'sockethub:' + parentId + ':session:' + sessionId + ':store',
    secret: parentSecret + sessionSecret,
    redis: config.get('redis')
  });
}