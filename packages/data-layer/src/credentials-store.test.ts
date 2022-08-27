import proxyquire from 'proxyquire';
import { expect } from 'chai';
import * as sinon from 'sinon';

proxyquire.noPreserveCache();
proxyquire.noCallThru();

const MockSecureStore = sinon.fake();

const StoreMod = proxyquire('./credentials-store', {
  'secure-store-redis': MockSecureStore
});

const CredentialsStore = StoreMod.default;

describe('CredentialsStore', () => {
  it('returns a valid CredentialsStore object', () => {
    const store = new CredentialsStore('a parent id', 'a session id', 'a secret', 'redis config');
    sinon.assert.calledOnce(MockSecureStore);
    sinon.assert.calledWith(MockSecureStore, {
      namespace: 'sockethub:data-layer:credentials-store:a parent id:a session id',
      secret: 'a secret',
      redis: 'redis config'
    });
    expect(typeof store).to.equal('object');
    expect(store.uid).to.equal(`sockethub:data-layer:credentials-store:a parent id:a session id`);
    expect(typeof store.get).to.equal('function');
    expect(typeof store.save).to.equal('function');
  });
});
