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
      rmLog('sessions: ' + SharedResources.sessionConnections.size +
        ' instances: ' + SharedResources.platformInstances.size);
    }

    for (let platformInstance of SharedResources.platformInstances.values()) {
      for (let sessionId of platformInstance.sessions.values()) {
        if (!SharedResources.sessionConnections.has(sessionId)) {
          rmLog('removing stale session reference ' + sessionId + ' in platform instance '
            + platformInstance.id);
          platformInstance.sessions.delete(sessionId);
        }
      }

      if (platformInstance.global) {
        // static platform for global use, don't do resource management
        continue;
      } else if (platformInstance.sessions.size <= 0) {
        if (platformInstance.flaggedForTermination) {
          // terminate
          rmLog(`terminating platform instance ${platformInstance.id} ` +
            `(flagged for termination: no registered sessions found)`);
          SharedResources.helpers.removePlatform(platformInstance);
        } else {
          rmLog(`flagging for termination platform instance ${platformInstance.id} ` +
            `(no registered sessions found)`);
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
