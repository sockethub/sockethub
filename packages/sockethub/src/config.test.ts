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
});