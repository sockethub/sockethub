import Redis from 'ioredis';

import config from '../config';

const client = new Redis(config.get('redis'));
const subscriber = new Redis(config.get('redis'));

const redisConfig = {
  createClient: function (type) {
    switch (type) {
      case 'client':
        return client;
      case 'subscriber':
        return subscriber;
      default:
        return new Redis(config.get('redis'));
    }
  }
};

export default redisConfig;