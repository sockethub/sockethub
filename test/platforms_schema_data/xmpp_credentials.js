var working_creds = require('./../../examples/credential-config.js');
var cfg = {
  'platform': 'xmpp',
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


// creds
cfg.tests.push({
  'willFail': true,
  'data': {
    'credentials': {
      'server': 'asdasdasdasd',
      'username': 'asdasdasdasd',
      'password': 'asdasdasdasd',
      'resource': 'asdasdasdasd',
      'port': 123
    }
  }
});

cfg.tests.push({
  'willFail': false,
  'data': {
    'credentials': {
      'bob' : {
        'server': 'asdasdasdasd',
        'username': 'asdasdasdasd',
        'password': 'asdasdasdasd',
        'resource': 'asdasdasdasd',
        'port': 123
      }
    }
  }
});


cfg.tests.push({
  'willFail': false,
  'data': working_creds[cfg.platform]
});

module.exports = cfg;