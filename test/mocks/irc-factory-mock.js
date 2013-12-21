var IRCFactory = function (test) {
  var callbacks = {};

  var clients = {};

  var api = {
    createClient: new test.Stub(function (key, creds) {
      console.log('IRC STUB: createClient called');

      client = {
        irc: {
          raw: test.Stub(function (arr) {
            console.log('IRC STUB: raw');
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
      clients[creds.nick] = client;
      setTimeout(function () {
        if (!callbacks[key]) {
          callbacks[key] = {};
        } else if (typeof callbacks[key].registered === 'function') {
          //console.log('IRC STUB: calling registered callback with client:', client);
          callbacks[key].registered(client);
        }
      }, 0);
      return client;
    }),
    unhookEvent: new test.Stub(function (key, name) {
      console.log('IRC STUB: unhookEvent');
      if (!callbacks[key]) {
        callbacks[key] = {};
      } else {
        delete callbacks[key][name];
      }
    }),
    hookEvent: new test.Stub(function (key, name, func) {
      console.log('IRC STUB: hookEvent');
      if (!callbacks[key]) {
        callbacks[key] = {};
      }
      callbacks[key][name] = func;
    })
  };

  return {
    ClientCalled: function (key) {
      return clients[key].irc.raw.called;
    },
    ClientNumCalled: function (key) {
      return clients[key].irc.raw.numCalled;
    },
    Api: function () {
      return api;
    }
  };
};

module.exports = function (test) {
  return new IRCFactory(test);
};