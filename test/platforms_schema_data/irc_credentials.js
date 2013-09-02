var working_creds = require('./../../examples/credential-config.js');
var cfg = {
  'platform': 'irc',
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
      'nick': 'asdasdasdasd',
      'password': 'asdasdasdasd',
      'channels': ['asdasdasdasd']
    }
  }
});

cfg.tests.push({
  'willFail': true,
  'data': {
    'credentials': {
      'bob' : {
        'server': 'asdasdasdasd',
        'nick': 'bob',
        'password': 'asdasdasdasd',
        'channels': 'asdasdasdasd'
      }
    }
  }
});

cfg.tests.push({
  'willFail': false,
  'data': {
    'credentials': {
      'bob' : {
        'server': 'asdasdasdasd',
        'nick': 'bob',
        'password': 'asdasdasdasd',
        'channels': ['asdasdasdasd']
      }
    }
  }
});


cfg.tests.push({
  'willFail': false,
  'data': working_creds[cfg.platform]
});

module.exports = cfg;