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
    'credentials': {
      '# useraddress #' : {
        'actor': {
          'address': '# useraddress #',
          'name':    '# displayname #'
        },
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
    }
  },
  facebook: {
    'credentials': {
      '# useraddress #': {
        'access_token' : '# token from facebook #',
        'actor': {
          'address': '# username #',
          'name':    '# displatname #'
        }
      }
    }
  },
  rss: {}, // none
  twitter: {
    'credentials': {
      '# useraddress #': {
        'access_token' :        '# token from twitter #',
        'access_token_secret' : '# token from twitter #',
        'consumer_secret' :     '# token from twitter #',
        'consumer_key' :        '# token from twitter #',
        'actor': {
          'address': '# username #',
          'name':    '# displatname #'
        }
      }
    }
  }
};

if (typeof module !== 'undefined') {
  module.exports = SOCKETHUB_CREDS;
}