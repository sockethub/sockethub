import debug from 'debug';

import PlatformInstance, { platformInstances } from './platform-instance';
import listener, { SocketInstance } from "./listener";

const rmLog = debug('sockethub:server:janitor');

class Janitor {
  cycleInterval = 15000;
  cycleCount = 0;   // a counter for each cycleInterval
  reportCount = 0;  // number of times a report is printed
  protected stopTriggered = false;
  protected sockets: Array<SocketInstance>;
  private cycleRunning = false;

  /**
   * Every TICK the `Janitor` will compare existing platform instances with `socket.ids`
   * (aka. `sessionId`). If all of the `sessionIds` associated with a `platformInstance` have
   * no corresponding `socket.id` (from the `http.io` `socket.io` instance), then the
   * `platformInstance` will first be flagged, if after the next `cycleInterval` the same
   * state is determined, the platform will be destroyed (this allows for page
   * refreshes not destroying platform instances)
   */
  clean(): void {
    rmLog('initializing');
    this.cycle().then(() => {
      rmLog('cleaning cycle started');
    });
  }

  removeSessionCallbacks(platformInstance: PlatformInstance, sessionId: string): void {
    for (const key in platformInstance.sessionCallbacks) {
      platformInstance.process.removeListener(
        key, platformInstance.sessionCallbacks[key].get(sessionId));
      platformInstance.sessionCallbacks[key].delete(sessionId);
    }
  }

  removeStaleSocketSessions(
    platformInstance: PlatformInstance
  ): void {
    for (const sessionId of platformInstance.sessions.values()) {
      if ((this.stopTriggered) || (!this.socketExists(sessionId))) {
        rmLog(
          `removing ${!this.stopTriggered ? 'stale ' : ''}socket session reference ${sessionId} 
          in platform instance ${platformInstance.id}`
        );
        platformInstance.sessions.delete(sessionId);
        this.removeSessionCallbacks(platformInstance, sessionId);
      }
    }
  }

  async removeStalePlatformInstance(platformInstance: PlatformInstance): Promise<void> {
    if ((platformInstance.flaggedForTermination) || (this.stopTriggered)) {
      rmLog(`terminating platform instance ${platformInstance.id}`);
      await platformInstance.destroy(); // terminate
    } else {
      rmLog(`flagging for termination platform instance ${platformInstance.id} ` +
        `(no registered sessions found)`);
      platformInstance.flaggedForTermination = true;
    }
  }

  stop(): void {
    this.stopTriggered = true;
  }

  private socketExists(sessionId: string) {
    for (const socket of this.sockets) {
      if (socket.id === sessionId) {
        return true;
      }
    }
    return false;
  }

  private async delay(ms): Promise<void> {
    return await new Promise(resolve => setTimeout(resolve, ms));
  }

  private async getSockets(): Promise<Array<SocketInstance>> {
    return await listener.io.fetchSockets();
  }

  private async cycle(): Promise<void> {
    if (this.cycleRunning) {
      throw new Error('janitor clean cycle called while already running');
    }
    this.cycleRunning = true;
    this.cycleCount++;
    this.sockets = await this.getSockets();

    if (this.stopTriggered) {
      rmLog('stopping, terminating all sessions');
      for (const platformInstance of platformInstances.values()) {
        this.removeStaleSocketSessions(platformInstance);
        await this.removeStalePlatformInstance(platformInstance);
        await platformInstance.destroy();
      }
      return;
    }

    if (!(this.cycleCount % 4)) {
      this.reportCount++;
      rmLog(
        `socket sessions: ${this.sockets.length} platform instances: ${platformInstances.size}`);
    }

    for (const platformInstance of platformInstances.values()) {
      this.removeStaleSocketSessions(platformInstance);
      // Static platforms are for global use, not tied to a unique to session / eg. credentials)
      if ((!platformInstance.global) && (platformInstance.sessions.size === 0)) {
        await this.removeStalePlatformInstance(platformInstance);
      } else {
        platformInstance.flaggedForTermination = false;
      }
    }
    this.cycleRunning = false;
    await this.delay(this.cycleInterval);
    return this.cycle();
  }
}

const janitor = new Janitor();
export default janitor;
