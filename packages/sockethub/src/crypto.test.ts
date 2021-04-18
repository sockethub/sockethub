import crypto from './crypto';

const secret = 'a test secret.. that is 16 x 2..';
const data = {'foo': 'bar'};
const encryptedData = "00000000000000000000000000000000:0543ec94d863fbf4b7a19b48e69d9317";

jest.mock('crypto', () => {
  const originalModule = jest.requireActual('crypto');
  return {
    __esModule: true,
    ...originalModule,
    randomBytes: jest.fn(() => Buffer.alloc(16)),
  };
});

describe('crypto', () => {
  it('encrypts', () => {
    expect(crypto.encrypt(data, secret)).toBe(encryptedData);
  });
  it('decrypts', () => {
    expect(crypto.decrypt(encryptedData, secret)).toStrictEqual(data);
  });
  it('hashes', () => {
    expect(crypto.hash('foobar')).toBe('8843d7f');
  });
});