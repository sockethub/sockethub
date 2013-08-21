var cfg = {
  'platform': 'facebook',
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
      'actor': 'asdasdasdasd'
    }
  }
});

cfg.tests.push({
  'willFail': true,
  'data': {
    'credentials': {
      'accessed_token' : 'sadfsdfsdf'
    }
  }
});

cfg.tests.push({
  'willFail': true,
  'data': {
    'credentials': {
      'access_token' : 'sadfsdfsdf',
      'actor' : 'sadfsdfsdf'
    }
  }
});

cfg.tests.push({
  'willFail': true,
  'data': {
    'credentials': {
      'yoyo' : {
        'accessed_token' : 'sadfsdfsdf',
        'actor' : 'yoyo'
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
        'actor' : { 'address' : 'jdoe' }
      }
    }
  }
});

cfg.tests.push({
  'willFail': false,
  'data': {
    'credentials': {
      'jdoe': {
        'access_token' : 'sadfsdfsdf'
      }
    }
  }
});

module.exports = cfg;