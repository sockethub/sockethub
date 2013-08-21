/**
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

var CRED_CFG = {
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
          'secure':   '# secure #',
          'port': 465 // must be number
        },
        'imap': {
          'host':     '# example.com #',
          'username': '# username #',
          'password': '# password #',
          'secure':   '# secure #',
          'port': 993 // must be number
        }
      }
    }
  },
  facebook: {
    'credentials': {
      '# username #': {
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
      '# username #': {
        'access_token' :        '# token from twitter #',
        'access_token_secret' : '# token from twitter #',
        'consumer_secret' :     '# token from twitter #',
        'consumer_key' :        '# token from twitter #'
      }
    }
  }
};

module.exports = CRED_CFG;