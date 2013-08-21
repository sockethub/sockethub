var working_creds = require('./../../examples/credential-config.js');
var cfg = {
  'platform': 'email',
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


// smtp
cfg.tests.push({
  'willFail': true,
  'data': {
    'credentials': {
      'smtp': {
        'host': 'asdasdasdasd',
        'username': 'asdasdasdasd',
        'password': 'asdasdasdasd',
        'secure': 'asdasdasdasd',
        'port': 'asdasdasdasd',
        'domain': 'asdasdasdasd',
        'mimeTransport': 'asdasdasdasd'
      }
    }
  }
});

cfg.tests.push({
  'willFail': false,
  'data': {
    'credentials': {
      'bob' : {
        'actor': {
          'address': 'bob',
          'name': "Bob Doe"
        },
        'smtp': {
          'host': 'asdasdasdasd',
          'username': 'asdasdasdasd',
          'password': 'asdasdasdasd',
          'secure': 'asdasdasdasd',
          'port': 123,
          'domain': 'asdasdasdasd',
          'mimeTransport': 'asdasdasdasd'
        }
      }
    }
  }
});

// imap
cfg.tests.push({
  'willFail': true,
  'data': {
    'credentials': {
      'imap': {
        'host': 'asdasdasdasd',
        'username': 'asdasdasdasd',
        'password': 'asdasdasdasd',
        'secure': 'asdasdasdasd',
        'port': 'asdasdasdasd'
      }
    }
  }
});

cfg.tests.push({
  'willFail': true,
  'data': {
    'credentials': {
      'bob' : {
        'actor': {
          'address': 'bob',
          'name': "Bob Doe"
        },
        'smtp': {
        }
      }
    }
  }
});

cfg.tests.push({
  'willFail': false,
  'data': {
    'credentials': {
      'bob' : {
        'actor': {
          'address': 'bob',
          'name': "Bob Doe"
        },
        'smtp': {
          'host': 'asdasdasdasd',
          'username': 'asdasdasdasd',
          'password': 'asdasdasdasd',
          'secure': 'asdasdasdasd',
          'port': 123
        }
      }
    }
  }
});


cfg.tests.push({
  'willFail': false,
  'data': working_creds[cfg.platform]
});

module.exports = cfg;