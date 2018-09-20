//////
// resource manager
//
const Debug      = require('debug'),
      SR = require('./shared-resources.js');

const rmdebug = Debug('sockethub:resource-manager');

let alreadCalled = false,
    cycleCount = 0,
    reportCount = 0;

function resourceManagerCyle() {
  if (! alreadCalled) { alreadCalled = true; }
  else { return; }

  rmdebug('initializing resource manager');
  setInterval(() => {
    cycleCount++;
    if (! cycleCount % 4) {
      reportCount++;
      rmdebug('sockets: ' + SR.socketConnections.size +
        ' instances: ' + SR.platformInstances.size);
    }

    for (let platformInstance of SR.platformInstances.values()) {
      for (let socketId of platformInstance.sockets.values()) {
        if (!SR.socketConnections.has(socketId)) {
          rmdebug('removing stale socket reference ' + socketId + ' in platform instance '
            + platformInstance.id);
          platformInstance.sockets.delete(socketId);
        }
      }

      if (platformInstance.sockets.size <= 0) {
        if (platformInstance.flaggedForTermination) {
          // terminate
          rmdebug(`terminating platform instance ${platformInstance.id} ` +
            `(flagged for termination: no registered sockets found)`);
          try {
            platformInstance.module.cleanup(() => {
              SR.helpers.removePlatform(platformInstance);
            });
          } catch (e) {
            SR.helpers.removePlatform(platformInstance);
          }
        } else {
          rmdebug(`flagging for termination platform instance ${platformInstance.id} ` +
            `(no registered sockets found)`);
          platformInstance.flaggedForTermination = true;
        }
      } else {
        platformInstance.flaggedForTermination = false;
      }
    }
  }, 15000);
}

module.exports = {
  start: resourceManagerCyle,
  alreadyCalled: alreadCalled,
  cycleCount: cycleCount,
  reportCount: reportCount
};