var IRCFactory = function (test) {
  var callbacks = {};

  var clients = [];

  var api = {
    createClient: new test.Stub(function (key, creds) {
      test.write('IRC STUB: createClient called key: ' + key );

      client = {
        irc: {
          raw: test.Stub(function (arr) {
            test.write('IRC STUB: raw');
          }),
          privmsg: test.Stub(function (arr) {
            test.write('IRC STUB: privmsg');
          }),
          triggerEvent: test.Stub(function (name) {
            if (!callbacks[key]) {
              callbacks[key] = {};
            } else if (typeof callbacks[key][name] === 'function') {
              callbacks[key][name]();
            }
          })
        }
      };
      clients.push(client);
      setTimeout(function () {
        if (!callbacks[key]) {
          callbacks[key] = {};
        } else if (typeof callbacks[key].registered === 'function') {
          //test.write('IRC STUB: calling registered callback with client:', client);
          callbacks[key].registered(client);
        }
      }, 0);
      return client;
    }),
    unhookEvent: new test.Stub(function (key, name) {
      test.write('IRC STUB: unhookEvent');
      if (!callbacks[key]) {
        callbacks[key] = {};
      } else {
        delete callbacks[key][name];
      }
    }),
    hookEvent: new test.Stub(function (key, name, func) {
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
    Api: function () {
      return api;
    }
  };
};

module.exports = function (test) {
  return new IRCFactory(test);
};
