import proxyquire from 'proxyquire';
import { expect } from 'chai';
import * as sinon from 'sinon';

proxyquire.noPreserveCache();
proxyquire.noCallThru();

describe('CredentialsStore', () => {
  let credentialsStore, mockStore, MockSecureStore, MockObjectHash, sandbox;
  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    mockStore = {
      get: sandbox.stub().returns('credential foo'),
      save: sandbox.stub(),
      init: sandbox.stub()
    };
    MockObjectHash = sandbox.stub();
    MockSecureStore = sandbox.stub().returns(mockStore);
    const StoreMod = proxyquire('./credentials-store', {
      'secure-store-redis': MockSecureStore,
      '@sockethub/crypto': {
        objectHash: MockObjectHash
      }
    });
    const CredentialsStore = StoreMod.default;
    credentialsStore = new CredentialsStore('a parent id', 'a session id', 'a secret', 'redis config');
    expect(typeof credentialsStore.init).to.equal('function');
    await credentialsStore.init();
  });

  afterEach(() => {
    sandbox.reset();
  })

  it('returns a valid CredentialsStore object', () => {
    sinon.assert.calledOnce(MockSecureStore);
    sinon.assert.calledWith(MockSecureStore,
      'sockethub:data-layer:credentials-store:a parent id:a session id', 'a secret', { redis: 'redis config' }
    );
    expect(typeof credentialsStore).to.equal('object');
    expect(credentialsStore.uid).to.equal(`sockethub:data-layer:credentials-store:a parent id:a session id`);
    expect(typeof credentialsStore.get).to.equal('function');
    expect(typeof credentialsStore.save).to.equal('function');
    expect(credentialsStore.initialized).to.be.true;
  });

  describe('get', () => {
    it('handles correct params', async () => {
      let res = await credentialsStore.get('an actor');
      sinon.assert.calledOnce(mockStore.get);
      sinon.assert.calledWith(mockStore.get, 'an actor');
      sinon.assert.notCalled(MockObjectHash);
      sinon.assert.notCalled(mockStore.save);
      expect(res).to.equal('credential foo');
    });

    it('handles no credentials found', async () => {
      mockStore.get.returns(undefined);
      let res = await credentialsStore.get('an non-existent actor');
      sinon.assert.calledOnce(mockStore.get);
      sinon.assert.calledWith(mockStore.get, 'an non-existent actor');
      sinon.assert.notCalled(MockObjectHash);
      sinon.assert.notCalled(mockStore.save);
      expect(res).to.be.undefined;
    });

    it('handles an unexpected error', async () => {
      mockStore.get.throws(new Error('sumting bad happen'));
      let res;
      try {
        res = await credentialsStore.get('a problem actor');
        throw new Error('should not reach this spot');
      } catch (err) {
        expect(err.toString()).to.eql('Error: sumting bad happen');
      }
      sinon.assert.calledOnce(mockStore.get);
      sinon.assert.calledWith(mockStore.get, 'a problem actor');
      sinon.assert.notCalled(MockObjectHash);
      sinon.assert.notCalled(mockStore.save);
      expect(res).to.be.undefined;
    });

    it('validates credentialsHash when provided', async () => {
      MockObjectHash.returns('a credentialHash string');
      mockStore.get.returns({
        object: 'a credential'
      });
      let res = await credentialsStore.get('an actor', 'a credentialHash string');
      sinon.assert.calledOnce(mockStore.get);
      sinon.assert.calledWith(mockStore.get, 'an actor');
      sinon.assert.calledOnce(MockObjectHash);
      sinon.assert.calledWith(MockObjectHash, 'a credential');
      sinon.assert.notCalled(mockStore.save);
      expect(res).to.eql({object: 'a credential'});
    });

    it('invalidates credentialsHash when provided', async () => {
      MockObjectHash.returns('the original credentialHash string');
      mockStore.get.returns({
        object: 'a credential'
      });
      let res;
      try {
        res = await credentialsStore.get('an actor', 'a different credentialHash string');
        throw new Error('should not reach this spot');
      } catch (err) {
        expect(err.toString()).to.equal('Error: provided credentials do not match existing platform instance for actor an actor');
      }
      sinon.assert.calledOnce(mockStore.get);
      sinon.assert.calledWith(mockStore.get, 'an actor');
      sinon.assert.calledOnce(MockObjectHash);
      sinon.assert.calledWith(MockObjectHash, 'a credential');
      sinon.assert.notCalled(mockStore.save);
      expect(res).to.be.undefined;
    });
  });

  describe('save', () => {
    it('handles success', async () => {
      const creds = {foo:'bar'};
      await credentialsStore.save('an actor', creds);
      sinon.assert.calledOnce(mockStore.save);
      sinon.assert.calledWith(mockStore.save, 'an actor', creds);
      sinon.assert.notCalled(MockObjectHash);
      sinon.assert.notCalled(mockStore.get);
    });

    it('handles failure', async () => {
      const creds = {foo: 'bar'};
      mockStore.save.throws(new Error('an error'));
      let e;
      try {
        await credentialsStore.save('an actor', creds);
      } catch (err) {
        e = err;
        sinon.assert.calledOnce(mockStore.save);
        sinon.assert.calledWith(mockStore.save, 'an actor', creds);
        sinon.assert.notCalled(MockObjectHash);
        sinon.assert.notCalled(mockStore.get);
        expect(err.toString()).to.equal('Error: an error');
      }
      if (!e) {
        throw new Error('Expected error, yet nothing caught.');
      }
    });
  });
});
