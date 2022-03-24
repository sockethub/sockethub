import SecureStore from 'secure-store-redis';

import config from "./config";

export interface ISecureStoreInstance {
  save(id: string, obj: any);
  get(id: string);
  delete(id: string);
}

export async function getSessionStore(parentId: string, parentSecret: string,
                                      sessionId: string, sessionSecret: string)
  : Promise<ISecureStoreInstance> {
  const store = new SecureStore(
    'sockethub:' + parentId + ':session:' + sessionId + ':store',
    parentSecret + sessionSecret,
    {
      redis: config.get('redis')
    }
  );
  await store.init();
  return store;
}
