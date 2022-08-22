import SecureStore from 'secure-store-redis';

import config from "./config";

export async function getSessionStore(
  parentId: string, parentSecret: string, sessionId: string, sessionSecret: string
): Promise<SecureStore> {
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
