import { getPlatformId, getSessionStore } from './common';
import crypto from './crypto';
import Store from 'secure-store-redis';

import { expect } from 'chai';
import * as sinon from 'sinon';

const proxyquire = require('proxyquire');
proxyquire.noPreserveCache();
proxyquire.noCallThru();


describe("getPlatformId", () => {
  let cryptoHashStub;

  beforeEach(() => {
    cryptoHashStub = sinon.stub(crypto, 'hash');
    cryptoHashStub.returnsArg(0);
    proxyquire('./common', { crypto: { hash: cryptoHashStub }});
  });

  afterEach(() => {
    cryptoHashStub.restore();
  });

  it('generates platform hash', () => {
    expect(getPlatformId('foo')).to.be.equal('foo');
    sinon.assert.calledOnce(cryptoHashStub);
    sinon.assert.calledWith(cryptoHashStub, 'foo');
  });
  it('generates platform + actor hash', () => {
    expect(getPlatformId('foo', 'bar')).to.be.equal('foobar');
    sinon.assert.calledOnce(cryptoHashStub);
    sinon.assert.calledWith(cryptoHashStub, 'foobar');
  });
});

describe('getSessionStore', () => {
  let secureStoreRedisStub;

  beforeEach(() => {
    secureStoreRedisStub = sinon.stub(Store, 'default').returns('lol');
    proxyquire('./common', { 'secure-store-redis': secureStoreRedisStub });
  });

  afterEach(() => {
    secureStoreRedisStub.restore();
  });

  it('returns a valid Store object', () => {
    const store = getSessionStore('a parent id', 'a parent secret',
      'a session id', 'a session secret');
    // console.log(store);
    console.log(secureStoreRedisStub);
    sinon.assert.calledOnce(secureStoreRedisStub);
    sinon.assert.calledWith(secureStoreRedisStub, {
      namespace: 'sockethub:a parent id:session:a session id:store',
      secret: 'a parent secret session secret',
      redis: undefined
    });
  });
});