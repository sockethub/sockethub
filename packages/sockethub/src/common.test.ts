import proxyquire from 'proxyquire'
import { expect } from 'chai';
import * as sinon from 'sinon';

import { getPlatformId} from './common';
import crypto from './crypto';

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
