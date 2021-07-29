import SecureStore from 'secure-store-redis';
import Redis from 'ioredis';

import config from "./config";

export interface ISecureStoreInstance {
  save(id: string, obj: any, cb: Function);
  get(id: string, cb: Function);
}

/**
 * This defines the config object that can be passed in to ioredis to make use of existing
 * connections.
 * https://github.com/OptimalBits/bull/blob/master/PATTERNS.md#reusing-redis-connections
 */
const client = new Redis(config.get('redis'));
const subscriber = new Redis(config.get('redis'));

export const redisConfig = {
  createClient: function (type) {
    switch (type) {
      case 'client':
        return client;
      case 'subscriber':
        return subscriber;
      default:
        return new Redis(config.get('redis'));
    }
  }
};

export function getSessionStore(parentId: string, parentSecret: string,
                                sessionId: string, sessionSecret: string): ISecureStoreInstance {
  return new SecureStore({
    namespace: 'sockethub:' + parentId + ':session:' + sessionId + ':store',
    secret: parentSecret + sessionSecret,
    redis: config.get('redis')
  });
}