/**
 *
 * This config file is used as a template for all of the examples here. It
 * also is used during the unit tests as examples of a good data struct that
 * should pass the json schema checks.
 *
 * So in effect it's the central authoritive example of what credentials
 * data should look like for each platform.
 *
 * examples:
 *
 *  - sending credential data with sockethub-client (assuming `sc` is
 *    a connected instance of SockethubClient):
 *
 *  sc.set('twitter', {
 *    'credentials' : {
 *      'access_token' : '# access token from twitter #'
 *    }
 *  }).then(function () {
 *    console.log('credentials set');
 *  }, function (err) {
 *    console.log('failed setting credentials: ', err);
 *  });
 *
 *
 */

var SOCKETHUB_CREDS = {
  email: {
    'verb': 'set',
    'platform': 'dispatcher',
    'actor': {
      'name': '# display name #',
      'address': '# username #'
    },
    'target': [{'platform': 'email'}],
    'object': {
      'objectType': 'credentials',
      'smtp': {
        'host':     '# example.com #',
        'username': '# username #',
        'password': '# password #',
        'tls':      true, // must be a boolean
        'port': 465 // must be number
      },
      'imap': {
        'host':     '# example.com #',
        'username': '# username #',
        'password': '# password #',
        'tls':      true, // must be a boolean
        'port': 993 // not required, must be number
      }
    }
  },
  facebook: {
    'verb': 'set',
    'platform': 'dispatcher',
    'target': [{'platform': 'facebook'}],
    'actor': {
      'address': '# username #',
      'name':    '# displayname #'
    },
    'object': {
      'objectType': 'credentials',
      'access_token' : '# token from facebook #'
    }
  },
  feeds: {}, // none
  twitter: {
    'verb': 'set',
    'platform': 'dispatcher',
    'target': [{'platform': 'twitter'}],
    'actor': {
      'address': '# username #',
      'name':    '# displayname #'
    },
    'object': {
      'objectType': 'credentials',
      'access_token' :        '# token from twitter #',
      'access_token_secret' : '# token from twitter #',
      'consumer_secret' :     '# token from twitter #',
      'consumer_key' :        '# token from twitter #',
    }
  },
  irc: {
    'verb': 'set',
    'platform': 'dispatcher',
    'target': [{'platform': 'irc'}],
    'actor': {
      'address': '# nickname #',
      'name':    '# displayname #'
    },
    'object': {
      'objectType': 'credentials',
      'nick' :      '# nickname #',
      'password' :  '# password #',
      'server' :    '# server #'
    }
  }
};

if (typeof module !== 'undefined') {
  module.exports = SOCKETHUB_CREDS;
}
