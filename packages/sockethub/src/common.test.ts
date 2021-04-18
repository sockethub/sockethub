import { getPlatformId, getSessionStore } from './common';
import crypto from './crypto';
import Store from 'secure-store-redis';

jest.mock('./config');
jest.mock('secure-store-redis');
jest.mock('./crypto', () => ({
  __esModule: true,
  default: {
    encrypt: jest.fn().mockImplementation(() => {
      console.log("encrypt called");
    }),
    decrypt: jest.fn().mockImplementation(() => {
      console.log("decrypt called");
    }),
    hash: jest.fn().mockImplementation((string) => {
      return string;
    }),
  }
}));

describe("getPlatformId", () => {
  it('generates platform hash', () => {
    expect(getPlatformId('foo')).toBe('foo');
    expect(crypto.hash).toBeCalledWith('foo');
  });
  it('generates platform + actor hash', () => {
    expect(getPlatformId('foo', 'bar')).toBe('foobar');
    expect(crypto.hash).toBeCalledWith('foobar');
  });
});

describe('getSessionStore', () => {
  it('returns a valid Store object', () => {
    getSessionStore('a parent id', 'a parent secret',
      'a session id', 'a session secret');
    expect(Store).toBeCalledWith({
      namespace: 'sockethub:a parent id:session:a session id:store',
      secret: 'a parent secreta session secret',
      redis: undefined
    });
  });
});