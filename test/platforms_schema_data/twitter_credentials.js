var working_creds = require('./../../examples/credential-config.js');
var cfg = {
  'platform': 'twitter',
  'type': 'set',
  'base_prop': 'credentials',
  'tests': []
};


// basic
cfg.tests.push({
  'willFail': false,
  'data': {
    'credentials': { // still need to figure a way to define this as invalid
    }
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
    'credentials': {
      'accessToken': 'asdasdasdasd',
      'accessTokenSecret': 'asdasdasdasd',
      'consumerSecret': 'asdasdasdasd',
      'consumerKey': 'asdasdasdasd'
    }
  }
});

cfg.tests.push({
  'willFail': true,
  'data': {
    'credentials': {
      'accessed_token' : 'sadfsdfsdf',
      'access_token_secret' : 'asdasdas',
      'consumer_secret' : 'sdfsfsdf',
      'consumer_key' : 'sdfsfsdf'
    }
  }
});

cfg.tests.push({
  'willFail': true,
  'data': {
    'credentials': {
      'yoyo' : {
        'accessed_token' : 'sadfsdfsdf',
        'access_token_secret' : 'asdasdas',
        'consumer_secret' : 'sdfsfsdf',
        'consumer_key' : 'sdfsfsdf'
      }
    }
  }
});

cfg.tests.push({
  'willFail': false,
  'data': {
    'credentials': {
      'jdoe': {
        'access_token' : 'sadfsdfsdf',
        'access_token_secret' : 'asdasdas',
        'consumer_secret' : 'sdfsfsdf',
        'consumer_key' : 'sdfsfsdf'
      }
    }
  }
});

cfg.tests.push({
  'willFail': false,
  'data': working_creds[cfg.platform]
});

module.exports = cfg;