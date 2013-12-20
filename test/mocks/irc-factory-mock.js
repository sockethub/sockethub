var IRCFactory = function (test) {
  var callbacks = {};

  return {
    Api: function () {
      return {
        createClient: new test.Stub(function (key, creds) {
          console.log('IRC STUB: createClient');

          if (!callbacks[key]) {
            callbacks[key] = {};
          } else if (typeof callbacks[key].registered === 'function') {
            callbacks[key].registered();
          }

          return {
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
    }
  };
};

module.exports = function (test) {
  return new IRCFactory(test);
};