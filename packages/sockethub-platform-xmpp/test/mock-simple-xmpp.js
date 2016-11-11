var SimpleXMPP = function (test) {
  var callbacks = {};

  var clients = [];

  var xmpp = {
    connect: new test.Stub(function (key, creds) {
      test.write('XMPP STUB: connect called key: ' + key );

      client = {
        raw: test.Stub(function (arr) {
          test.write('XMPP STUB: raw');
        }),
        send: test.Stub(function (arr) {
          test.write('XMPP STUB: privmsg');
        }),
        triggerEvent: test.Stub(function (name) {
          if (!callbacks[key]) {
            callbacks[key] = {};
          } else if (typeof callbacks[key][name] === 'function') {
            callbacks[key][name]();
          }
        })
      };
      clients.push(client);
      setTimeout(function () {
        if (!callbacks[key]) {
          callbacks[key] = {};
        } else if (typeof callbacks[key].registered === 'function') {
          //test.write('XMPP STUB: calling registered callback with client:', client);
          callbacks[key].registered(client);
        }
      }, 0);
      return client;
    }),
    removeListener: new test.Stub(function (key, name) {
      test.write('XMPP STUB: unhookEvent');
      if (!callbacks[key]) {
        callbacks[key] = {};
      } else {
        delete callbacks[key][name];
      }
    }),
    on: new test.Stub(function (key, name, func) {
      test.write('IRC STUB: hookEvent');
      if (!callbacks[key]) {
        callbacks[key] = {};
      }
      callbacks[key][name] = func;
    })
  };

  return {
    ClientCalled: function (pos) {
      return clients[pos].irc.raw.called;
    },
    ClientNumCalled: function (pos) {
      return clients[pos].irc.raw.numCalled + clients[pos].irc.privmsg.numCalled;
    },
    xmpp: function () {
      return xmpp;
    }
  };
};

module.exports = function (test) {
  return new SimpleXMPP(test);
};
