import { expect } from 'chai';
import proxyquire from 'proxyquire';

const crypto = proxyquire('./crypto', {
  'crypto': {
    randomBytes: () => Buffer.alloc(16)
  }
}).default;

const secret = 'a test secret.. that is 16 x 2..';
const data = {'foo': 'bar'};
const encryptedData = "00000000000000000000000000000000:0543ec94d863fbf4b7a19b48e69d9317";

describe('crypto', () => {
  it('encrypts', () => {
    expect(crypto.encrypt(data, secret)).to.be.equal(encryptedData);
  });
  it('decrypts', () => {
    expect(crypto.decrypt(encryptedData, secret)).to.eql(data);
  });
  it('hashes', () => {
    expect(crypto.hash('foobar')).to.be.equal('8843d7f');
  });
  it('randTokens 8', () => {
    const token = crypto.randToken(8);
    expect(token.length).to.be.equal(8);
  });
  it('randTokens 16', () => {
    const token = crypto.randToken(16);
    expect(token.length).to.be.equal(16);
  });
  it('randTokens 32', () => {
    const token = crypto.randToken(32);
    expect(token.length).to.be.equal(32);
  });
  it('randTokens 33+ will fail', () => {
    expect(() => {
      crypto.randToken(33);
    }).to.throw();
  });
});