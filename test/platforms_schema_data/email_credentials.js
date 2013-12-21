var working_creds = require('./../../examples/credential-config.js');
var cfg = {
  'platform': 'email',
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

// smtp
cfg.tests.push({
  'willFail': true,
  'data': {
    'smtp': {
      'host': 'asdasdasdasd',
      'username': 'asdasdasdasd',
      'password': 'asdasdasdasd',
      'tls': 'asdasdasdasd',
      'port': 'asdasdasdasd',
      'domain': 'asdasdasdasd',
      'mimeTransport': 'asdasdasdasd'
    }
  }
});

cfg.tests.push({
  'willFail': true,
  'data': {
    'smtp': {
      'objectType': 'credentials',
      'host': 'asdasdasdasd',
      'username': 'asdasdasdasd',
      'password': 'asdasdasdasd',
      'tls': true,
      'port': 'asdasdasdasd',
      'domain': 'asdasdasdasd',
      'mimeTransport': 'asdasdasdasd'
    }
  }
});

cfg.tests.push({
  'willFail': false,
  'data': {
    'objectType': 'credentials',
    'smtp': {
      'host': 'asdasdasdasd',
      'username': 'asdasdasdasd',
      'password': 'asdasdasdasd',
      'tls': true,
      'domain': 'asdasdasdasd',
      'mimeTransport': 'asdasdasdasd'
    }
  }
});

// imap
cfg.tests.push({
  'willFail': true,
  'data': {
    'imap': {
      'host': 'asdasdasdasd',
      'username': 'asdasdasdasd',
      'password': 'asdasdasdasd',
      'tls': 'asdasdasdasd',
      'port': 'asdasdasdasd'
    }
  }
});

cfg.tests.push({
  'willFail': true,
  'data': {
    'bob' : {
      'actor': {
        'address': 'bob',
        'name': "Bob Doe"
      },
      'smtp': {
      }
    }
  }
});

cfg.tests.push({
  'willFail': false,
  'data': {
    'objectType': 'credentials',
    'smtp': {
      'host': 'asdasdasdasd',
      'username': 'asdasdasdasd',
      'password': 'asdasdasdasd',
      'port': 123
    }
  }
});

cfg.tests.push({
  'willFail': false,
  'data': working_creds[cfg.platform].object
});

module.exports = cfg;