var working_creds = require('./../../examples/credential-config.js');
var cfg = {
  'platform': 'irc',
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


// creds
cfg.tests.push({
  'willFail': true,
  'data': {
    'objectType': 'credentials',
    'server': 'asdasdasdasd',
    'nick': 'asdasdasdasd',
    'password': 'asdasdasdasd',
    'channels': ['asdasdasdasd']
  }
});

cfg.tests.push({
  'willFail': true,
  'data': {
    'server': 'asdasdasdasd',
    'nick': 'bob',
    'password': 'asdasdasdasd',
    'channels': 'asdasdasdasd'
  }
});

cfg.tests.push({
  'willFail': false,
  'data': {
    'objectType': 'credentials',
    'server': 'asdasdasdasd',
    'nick': 'bob',
    'password': 'asdasdasdasd'
  }
});


cfg.tests.push({
  'willFail': false,
  'data': working_creds[cfg.platform].object
});

module.exports = cfg;