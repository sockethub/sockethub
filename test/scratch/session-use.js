var SessionManager = require('./../../lib/sockethub/session.js')({
        platform: 'test',
        sockethubId: '123456',
        encKey: 'sdfasdf'
      });

console.log('SM: ', SessionManager);
