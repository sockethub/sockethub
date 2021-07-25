import proxyquire from 'proxyquire';
import { expect } from 'chai';
import * as sinon from 'sinon'

proxyquire.noPreserveCache();
proxyquire.noCallThru()

// class MockRedis {}
const MockRedis = sinon.fake();

const StoreMod = proxyquire('./store', {
  'ioredis': MockRedis
});

const getSessionStore = StoreMod.getSessionStore;
const redisConfig = StoreMod.redisConfig;

describe('getSessionStore', () => {
  it('returns a valid Store object', () => {
    const secureStoreRedisSpy = sinon.spy();
    const store = getSessionStore('a parent id', 'a parent secret',
      'a session id', 'a session secret', secureStoreRedisSpy);
    sinon.assert.calledOnce(secureStoreRedisSpy);
    sinon.assert.calledWith(secureStoreRedisSpy, {
      namespace: 'sockethub:a parent id:session:a session id:store',
      secret: 'a parent secreta session secret',
      redis: { host: '127.0.0.1', port: 6379 }
    });
  });
});


describe('config', () => {
  afterEach(() => {
    sinon.restore();
  });

  // it('prioritizes redis url', () => {
  //   process.env = { REDIS_URL: 'a redis url' };
  //   const nconf = require('nconf');
  //   const config = require('./config');
  //   expect(config.default).toHaveProperty('get');
  //   expect(config.default.get('redis')).toStrictEqual(
  //     {"host": "127.0.0.1", "port": 6379, "url": "a redis url"});
  // });

//   it('defaults to redis config', () => {
//     process.env = { REDIS_URL: '' };
//     const nconf = require('nconf');
//     const config = require('./config');
//     expect(config.default).toHaveProperty('get');
//     expect(config.default.get('redis')).toStrictEqual(
//       {"host": "127.0.0.1", "port": 6379});
//   });

  it('has a redisConfig object', () => {
    expect(redisConfig.createClient).to.be.ok;
    expect(MockRedis.callCount).to.equal(2);
  })

  it('returns existing client', () => {
    const client1 = redisConfig.createClient('client');
    expect(MockRedis.callCount).to.equal(2);
  });

  it('returns existing subscriber', () => {
    const client1 = redisConfig.createClient('subscriber');
    expect(MockRedis.callCount).to.equal(2);
  });

  it('returns new client otherwise', () => {
    const client1 = redisConfig.createClient('foo');
    expect(MockRedis.callCount).to.equal(3);
  });
});
