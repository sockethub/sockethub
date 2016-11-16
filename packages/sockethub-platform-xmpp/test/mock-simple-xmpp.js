var SimpleXMPP = function (test) {
  var callbacks = {};

  var clients = [];

  var xmpp = {
    connect: new test.Stub(function (creds) {
      test.write('XMPP STUB: connect called: ' + creds.jid );

      client = {
        send: test.Stub(function (arr) {
          test.write('XMPP STUB: privmsg');
        }),
        triggerEvent: test.Stub(function (name) {
          if (!callbacks) {
            callbacks = {};
          } else if (typeof callbacks[name] === 'function') {
            callbacks[name]();
          }
        })
      };
      clients.push(client);
      setTimeout(function () {
        // console.log('call registered ', Object.keys(callbacks));
        if (!callbacks) {
          callbacks = {};
        } else if (typeof callbacks.online === 'function') {
          //test.write('XMPP STUB: calling registered callback with client:', client);
          callbacks.online(client);
        }
      }, 0);
      return client;
    }),
    removeListener: new test.Stub(function (key, name) {
      test.write('XMPP STUB: unhookEvent');
      if (!callbacks) {
        callbacks = {};
      } else {
        delete callbacks[name];
      }
    }),
    on: new test.Stub(function (name, func) {
      test.write('XMPP STUB: hookEvent');
      if (!callbacks) {
        callbacks = {};
      }
      callbacks[name] = func;
    }),
    send: new test.Stub(function (target, message) {
      test.write('XMPP STUB: send')
    }),
    setPresence: new test.Stub(function (target, message) {
      test.write('XMPP STUB: setPresence')
    }),
    getRoster: new test.Stub(function (target, message) {
      test.write('XMPP STUB: getRoster')
    })
  };

  return {
    ClientCalled: function (pos) {
      return clients[pos].send.called;
    },
    ClientNumCalled: function (pos) {
      console.log('clients['+pos+'] ', clients[pos]);
      return clients[pos].send.numCalled;
      // + clients[pos].xmpp.privmsg.numCalled;
    },
    xmpp: function () {
      return xmpp;
    }
  };
};

module.exports = function (test) {
  return new SimpleXMPP(test);
};
