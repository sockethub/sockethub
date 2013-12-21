//var working_creds = require('./../../examples/credential-config.js');
var cfg = {
  'platform': 'xmpp',
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
    'server': 'asdasdasdasd',
    'username': 'asdasdasdasd',
    'password': 'asdasdasdasd',
    'resource': 'asdasdasdasd',
    'port': 123
  }
});

cfg.tests.push({
  'willFail': false,
  'data': {
    'objectType': 'credentials',
    'server': 'asdasdasdasd',
    'username': 'asdasdasdasd',
    'password': 'asdasdasdasd',
    'resource': 'asdasdasdasd',
    'port': 123
  }
});


// cfg.tests.push({
//   'willFail': false,
//   'data': working_creds[cfg.platform].object
// });

module.exports = cfg;