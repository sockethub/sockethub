var ClientManager = require('./../../lib/sockethub/client-manager.js');
var cm = ClientManager('test', '123');


cm.addClient('testkey', {end: function(){ console.log('hallo, ending');}});
console.log(cm.getClientReferences('testkey'));
cm.removeClient('testkey');
