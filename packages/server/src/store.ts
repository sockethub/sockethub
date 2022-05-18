import SecureStore from 'secure-store-redis';

import config from "./config";
import {CallbackInterface} from "./basic-types";
import {IActivityStream} from "@sockethub/schemas";

type StoreGetData = IActivityStream;
interface StoreCallbackInterface {
  (err?: unknown, data?: StoreGetData): void;
}

export interface ISecureStoreInstance {
  save(id: string, obj: unknown, cb: CallbackInterface): void;
  get(id: string, cb: StoreCallbackInterface);
}

export function getSessionStore(parentId: string, parentSecret: string,
                                sessionId: string, sessionSecret: string): ISecureStoreInstance {
  return new SecureStore({
    namespace: 'sockethub:' + parentId + ':session:' + sessionId + ':store',
    secret: parentSecret + sessionSecret,
    redis: config.get('redis')
  });
}
