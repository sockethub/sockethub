import { redisConfig } from "./config";

import Redis from 'ioredis';

jest.mock('ioredis');

// jest.mock('ioredis', () => ({
//   counter: 1,
//   __esModule: true,
//   default: jest.fn() )
// }));

describe('config', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('prioritizes redis url', () => {
    process.env = { REDIS_URL: 'a redis url' };
    const nconf = require('nconf');
    const config = require('./config');
    expect(config.default).toHaveProperty('get');
    expect(config.default.get('redis')).toStrictEqual(
      {"host": "127.0.0.1", "port": 6379, "url": "a redis url"});
  });

  it('defaults to redis config', () => {
    process.env = { REDIS_URL: '' };
    const nconf = require('nconf');
    const config = require('./config');
    expect(config.default).toHaveProperty('get');
    expect(config.default.get('redis')).toStrictEqual(
      {"host": "127.0.0.1", "port": 6379});
  });

  it('has a redisConfig object', () => {
    expect(redisConfig).toHaveProperty('createClient');
    expect(Redis).toHaveBeenCalledTimes(2);
  })

  it('returns existing client', () => {
    const client1 = redisConfig.createClient('client');
    expect(Redis).toHaveBeenCalledTimes(2);
  });

  it('returns existing subscriber', () => {
    const client1 = redisConfig.createClient('subscriber');
    expect(Redis).toHaveBeenCalledTimes(2);
  });

  it('returns new client otherwise', () => {
    const client1 = redisConfig.createClient('foo');
    expect(Redis).toHaveBeenCalledTimes(3);
  });
});
