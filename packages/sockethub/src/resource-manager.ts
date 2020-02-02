import debug from 'debug';

import SharedResources from './shared-resources';

const rmLog = debug('sockethub:resource-manager');

let alreadyCalled: boolean = false;
let cycleCount: number = 0;
let reportCount: number = 0;

function resourceManagerCycle() {
  if (! alreadyCalled) { alreadyCalled = true; }
  else { return; }

  rmLog('initializing resource manager');
  setInterval(() => {
    cycleCount++;
    const mod = cycleCount % 4;
    if (! mod) {
      reportCount++;
      rmLog('sockets: ' + SharedResources.socketConnections.size +
        ' instances: ' + SharedResources.platformInstances.size);
    }

    for (let platformInstance of SharedResources.platformInstances.values()) {
      for (let socketId of platformInstance.sockets.values()) {
        if (!SharedResources.socketConnections.has(socketId)) {
          rmLog('removing stale socket reference ' + socketId + ' in platform instance '
            + platformInstance.id);
          platformInstance.sockets.delete(socketId);
        }
      }

      if (platformInstance.sockets.size <= 0) {
        if (platformInstance.flaggedForTermination) {
          // terminate
          rmLog(`terminating platform instance ${platformInstance.id} ` +
            `(flagged for termination: no registered sockets found)`);
          try {
            platformInstance.module.cleanup(() => {
              SharedResources.helpers.removePlatform(platformInstance);
            });
          } catch (e) {
            SharedResources.helpers.removePlatform(platformInstance);
          }
        } else {
          rmLog(`flagging for termination platform instance ${platformInstance.id} ` +
            `(no registered sockets found)`);
          platformInstance.flaggedForTermination = true;
        }
      } else {
        platformInstance.flaggedForTermination = false;
      }
    }
  }, 15000);
}

const ResourceManager = {
  start: resourceManagerCycle,
  alreadyCalled: alreadyCalled,
  cycleCount: cycleCount,
  reportCount: reportCount
};
export default ResourceManager;