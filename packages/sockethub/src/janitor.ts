import debug from 'debug';

import PlatformInstance, { platformInstances } from './platform-instance';
import serve, { SocketInstance } from "./serve";

const rmLog = debug('sockethub:janitor');

const TICK = 15000;
let alreadyCalled: boolean = false;
let cycleCount: number = 0;   // a counter for each setInterval call
let reportCount: number = 0;  // number of times a report is printed

/**
 * Every TICK the Janitor will compare existing platform instances with socket.ids (aka. sessionId)
 * If all of the sessionIds associated with a platformInstance have no corresponding socket.id
 * (from the http.io socket.io instance), then the platformInstance will first be flagged, if after
 * the next TICK the same state is determined, the platform will be destroyed (this allows for page
 * refreshes not destroying platform instances)
 */
function janitorCycle() {
  if (! alreadyCalled) { alreadyCalled = true; }
  else { return; }
  rmLog('initializing resource manager');
  setInterval(async () => {
    cycleCount++;
    const sockets: Array<SocketInstance> = await serve.io.fetchSockets();

    if (! (cycleCount % 4)) {
      reportCount++;
      rmLog(`socket sessions: ${sockets.length} platform instances: ${platformInstances.size}`);
    }

    for (let platformInstance of platformInstances.values()) {
      removeStaleSocketSessions(platformInstance, sockets);
      // Static platforms are for global use, not tied to a unique to session / eg. credentials)
      if ((! platformInstance.global) && (platformInstance.sessions.size === 0)) {
        removeStalePlatformInstance(platformInstance);
      } else {
        platformInstance.flaggedForTermination = false;
      }
    }
  }, TICK);
}

function socketExists(sessionId: string, sockets: Array<SocketInstance>) {
  for (let socket of sockets) {
    if (socket.id === sessionId) {
      return true;
    }
  }
  return false;
}

function removeSessionCallbacks(platformInstance: PlatformInstance, sessionId: string) {
  for (const key in platformInstance.sessionCallbacks) {
    platformInstance.sessionCallbacks[key].delete(sessionId);
  }
}

function removeStaleSocketSessions(platformInstance: PlatformInstance,
                                   sockets: Array<SocketInstance>) {
  for (const sessionId of platformInstance.sessions.values()) {
    if (! socketExists(sessionId, sockets)) {
      rmLog('removing stale socket session reference ' + sessionId + ' in platform instance '
        + platformInstance.id);
      platformInstance.sessions.delete(sessionId);
      removeSessionCallbacks(platformInstance, sessionId);
    }
  }
}

function removeStalePlatformInstance(platformInstance: PlatformInstance) {
  if (platformInstance.flaggedForTermination) {
    rmLog(`terminating platform instance ${platformInstance.id}`);
    platformInstance.destroy(); // terminate
  } else {
    rmLog(`flagging for termination platform instance ${platformInstance.id} ` +
      `(no registered sessions found)`);
    platformInstance.flaggedForTermination = true;
  }
}

const janitor = {
  clean: janitorCycle,
  alreadyCalled: alreadyCalled,
  cycleCount: cycleCount,
  reportCount: reportCount
};
export default janitor;
