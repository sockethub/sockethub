import proxyquire from 'proxyquire';
import * as sinon from 'sinon';

proxyquire.noPreserveCache();
proxyquire.noCallThru();

const MockSecureStore = sinon.fake();

const StoreMod = proxyquire('./store', {
  'secure-store-redis': MockSecureStore
});

const getSessionStore = StoreMod.getSessionStore;

describe('getSessionStore', () => {
  it('returns a valid Store object', () => {
    const store = getSessionStore('a parent id', 'a parent secret',
      'a session id', 'a session secret');
    sinon.assert.calledOnce(MockSecureStore);
    sinon.assert.calledWith(MockSecureStore, {
      namespace: 'sockethub:a parent id:session:a session id:store',
      secret: 'a parent secreta session secret',
      redis: { host: '127.0.0.1', port: 6379 }
    });
  });
});
