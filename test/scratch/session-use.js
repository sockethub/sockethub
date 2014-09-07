console.log('MODULE:', module);
var SessionManager = require('./../../lib/sockethub/session-manager.js')({
        platform: 'test',
        sockethubId: '123456',
        encKey: 'sdfasdf'
      });

console.log('SM: ', SessionManager);
