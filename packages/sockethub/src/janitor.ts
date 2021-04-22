import debug from 'debug';

import { platformInstances } from './platform-instance';
import serve from "./serve";

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
    const sockets = await serve.io.fetchSockets();

    if (! (cycleCount % 4)) {
      reportCount++;
      rmLog(`sessions: ${sockets.length} instances: ${platformInstances.size}`);
    }

    for (let platformInstance of platformInstances.values()) {
      removeStaleSessions(platformInstance, sockets);
      removeStalePlatformInstances(platformInstance);
    }
  }, TICK);
}

function removeStaleSessions(platformInstance, sockets) {
  for (let sessionId of platformInstance.sessions.values()) {
    for (let socket of sockets) {
      if (socket.id === sessionId) {
        return;
      }
    }
    rmLog('removing stale session reference ' + sessionId + ' in platform instance '
      + platformInstance.id);
    platformInstance.sessions.delete(sessionId);
  }
}

function removeStalePlatformInstances(platformInstance) {
  // Static platforms are for global use, not tied to a unique to session / eg. credentials)
  if ((! platformInstance.global) && (platformInstance.sessions.size <= 0)) {
    if (platformInstance.flaggedForTermination) {
      rmLog(`terminating platform instance ${platformInstance.id} ` +
        `(flagged for termination: no registered sessions found)`);
      platformInstance.destroy(); // terminate
    } else {
      rmLog(`flagging for termination platform instance ${platformInstance.id} ` +
        `(no registered sessions found)`);
      platformInstance.flaggedForTermination = true;
    }
  } else {
    platformInstance.flaggedForTermination = false;
  }
}

const janitor = {
  start: janitorCycle,
  alreadyCalled: alreadyCalled,
  cycleCount: cycleCount,
  reportCount: reportCount
};
export default janitor;
