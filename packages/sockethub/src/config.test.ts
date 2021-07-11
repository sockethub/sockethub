import { expect } from 'chai';

import { Config } from './config';

describe('config', () => {

  it('loads default values', () => {
    const config = new Config();
    expect(config).to.have.property('get');
    expect(config.get('service:host')).to.eql('localhost');
  });

  it('overrides from env', () => {
    const hostname = 'a host string';
    process.env = { HOST: hostname };
    const config = new Config();
    expect(config).to.have.property('get');
    expect(config.get('service:host')).to.eql(hostname);
  });

  it('defaults to redis config', () => {
    process.env = { REDIS_URL: '' };
    const config = new Config();
    expect(config).to.have.property('get');
    expect(config.get('redis')).to.eql(
      {"host": "127.0.0.1", "port": 6379});
  });
});
