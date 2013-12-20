var SimpleXmpp = function (test) {
  var callbacks = {};
  return {
    on: new test.Stub(function (name, cb) {
      console.log('XMPP STUB: on '+name);
      callbacks[name] = cb;
    }),
    send: new test.Stub(function (address, text) {
      console.log("XMPP STUB: send");
    }),
    connect: new test.Stub(function (creds) {
      console.log('XMPP STUB: connect');
      if (typeof callbacks.online === 'function') {
        callbacks['online']();
      }
    }),
    removeListener: function () {},
    listeners: function() {},
    addListener: function() {},
    getRoster: new test.Stub(function (creds) {
      console.log('XMPP STUB: getRoster');
      //if (typeof callbacks.online === 'function') {
      //  callbacks['online']();
      //}
    })
  };
};

module.exports = function (test) {
  return new SimpleXmpp(test);
};