module.exports = function (test) {
  var callbacks = {};

  return {
    removeListener: new test.Stub(function (target) {
      test.write('SOCKET.IO STUB: removeListener');
      if (! callbacks) {
        callbacks = {};
      } else {
        delete callbacks[target];
      }
    }),
    on: new test.Stub(function (target, func) {
      test.write('SOCKET.IO STUB: on ' + target);
      if (! callbacks) {
        callbacks = {};
      }
      callbacks[target] = func;
    }),
    emit: new test.Stub(function (target, message) {
      test.write('SOCKET.IO STUB: emit ' + target);
      if (typeof callbacks[target] === 'function') {
        callbacks[target](message);
      }
    }),
    triggerEvent: test.Stub(function (target) {
      test.write('SOCKET.IO STUB: triggerEvent');
      if (!callbacks) {
        callbacks = {};
      } else if (typeof callbacks[target] === 'function') {
        callbacks[target]();
      }
    })
  };
};;