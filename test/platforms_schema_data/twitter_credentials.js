var working_creds = require('./../../examples/credential-config.js');
var cfg = {
  'platform': 'twitter',
  'type': 'set',
  'base_prop': 'credentials',
  'tests': []
};


// basic
cfg.tests.push({
  'willFail': true,
  'data': {
    'credentials': {}
  }
});

cfg.tests.push({
  'willFail': true,
  'data': {
    'sdfsdf': 'asdasd'
  }
});

cfg.tests.push({
  'willFail': true,
  'data': {
    'accessToken': 'asdasdasdasd',
    'accessTokenSecret': 'asdasdasdasd',
    'consumerSecret': 'asdasdasdasd',
    'consumerKey': 'asdasdasdasd'
  }
});

cfg.tests.push({
  'willFail': true,
  'data': {
    'accessed_token' : 'sadfsdfsdf',
    'access_token_secret' : 'asdasdas',
    'consumer_secret' : 'sdfsfsdf',
    'consumer_key' : 'sdfsfsdf'
  }
});

cfg.tests.push({
  'willFail': true,
  'data': {
    'yoyo' : {
      'accessed_token' : 'sadfsdfsdf',
      'access_token_secret' : 'asdasdas',
      'consumer_secret' : 'sdfsfsdf',
      'consumer_key' : 'sdfsfsdf'
    }
  }
});

cfg.tests.push({
  'willFail': false,
  'data': {
    'objectType' : 'credentials',
    'access_token' : 'sadfsdfsdf',
    'access_token_secret' : 'asdasdas',
    'consumer_secret' : 'sdfsfsdf',
    'consumer_key' : 'sdfsfsdf'
  }
});

cfg.tests.push({
  'willFail': false,
  'data': working_creds[cfg.platform].object
});

module.exports = cfg;