var SimpleXMPP = function (test) {
  var callbacks = {};

  var xmpp = {
    connect: new test.Stub(function (creds) {
      test.write('XMPP STUB: connect called: ' + creds.jid );
      setTimeout(function () {
        // console.log('call registered ', Object.keys(callbacks));
        if (!callbacks) {
          callbacks = {};
        } else if (typeof callbacks.online === 'function') {
          //test.write('XMPP STUB: calling registered callback with client:', client);
          callbacks.online();
        }
      }, 0);
    }),
    removeListener: new test.Stub(function (key, name) {
      test.write('XMPP STUB: unhookEvent');
      if (! callbacks) {
        callbacks = {};
      } else {
        delete callbacks[name];
      }
    }),
    on: new test.Stub(function (name, func) {
      test.write('XMPP STUB: hookEvent');
      if (! callbacks) {
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
    }),
    triggerEvent: test.Stub(function (name) {
      if (!callbacks) {
        callbacks = {};
      } else if (typeof callbacks[name] === 'function') {
        callbacks[name]();
      }
    })
  };

  return xmpp;
};

module.exports = function (test) {
  return new SimpleXMPP(test);
};
