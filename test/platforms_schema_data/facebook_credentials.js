var working_creds = require('./../../examples/credential-config.js');
var cfg = {
  'platform': 'facebook',
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
    'actor': 'asdasdasdasd'
  }
});

cfg.tests.push({
  'willFail': true,
  'data': {
    'accessed_token' : 'sadfsdfsdf'
  }
});

cfg.tests.push({
  'willFail': true,
  'data': {
    'objectType': 'credentials',
    'accessed_token' : 'sadfsdfsdf'
  }
});

cfg.tests.push({
  'willFail': true,
  'data': {
    'access_token' : 'sadfsdfsdf',
    'actor' : 'sadfsdfsdf'
  }
});

cfg.tests.push({
  'willFail': true,
  'data': {
    'yoyo' : {
      'accessed_token' : 'sadfsdfsdf',
      'actor' : 'yoyo'
    }
  }
});

cfg.tests.push({
  'willFail': false,
  'data': {
    'objectType': 'credentials',
    'access_token' : 'sadfsdfsdf',
  }
});

cfg.tests.push({
  'willFail': false,
  'data': working_creds[cfg.platform].object
});

module.exports = cfg;