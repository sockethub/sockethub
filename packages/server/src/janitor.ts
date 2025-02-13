import debug from "debug";

import listener, { type SocketInstance } from "./listener.js";
import type PlatformInstance from "./platform-instance.js";
import { platformInstances } from "./platform-instance.js";

const rmLog = debug("sockethub:server:janitor");

export class Janitor {
    cycleInterval = 15000;
    cycleCount = 0; // a counter for each cycleInterval
    reportCount = 0; // number of times a report is printed
    protected stopTriggered = false;
    protected sockets: Array<SocketInstance>;
    private cycleRunning = false;

    /**
     * Every TICK the `Janitor` will compare existing platform instances with `socket.ids`
     * (aka. `sessionId`). If all the `sessionIds` associated with a `platformInstance` have
     * no corresponding `socket.id` (from the `http.io` `socket.io` instance), then the
     * `platformInstance` will first be flagged, if after the next `cycleInterval` the same
     * state is determined, the platform will be destroyed (this allows for page
     * refreshes not destroying platform instances)
     */
    start(): void {
        rmLog("initializing");
        this.clean().then(() => {
            rmLog("cleaning cycle started");
        });
    }

    async stop(): Promise<void> {
        this.stopTriggered = true;
        rmLog("stopping, terminating all sessions");
        for (const platformInstance of platformInstances.values()) {
            this.removeStaleSocketSessions(platformInstance);
            await this.removeStalePlatformInstance(platformInstance);
            await platformInstance.shutdown();
        }
    }

    private removeSessionCallbacks(
        platformInstance: PlatformInstance,
        sessionId: string,
    ): void {
        for (const key in platformInstance.sessionCallbacks) {
            platformInstance.process.removeListener(
                key,
                platformInstance.sessionCallbacks[key].get(sessionId),
            );
            platformInstance.sessionCallbacks[key].delete(sessionId);
        }
    }

    private removeStaleSocketSessions(
        platformInstance: PlatformInstance,
    ): void {
        for (const sessionId of platformInstance.sessions.values()) {
            if (this.stopTriggered || !this.socketExists(sessionId)) {
                this.removeStaleSocketSession(platformInstance, sessionId);
            }
        }
    }

    private removeStaleSocketSession(
        platformInstance: PlatformInstance,
        sessionId: string,
    ) {
        rmLog(
            `removing ${
                !this.stopTriggered ? "stale " : ""
            }socket session reference ${sessionId} 
          in platform instance ${platformInstance.id}`,
        );
        platformInstance.sessions.delete(sessionId);
        this.removeSessionCallbacks(platformInstance, sessionId);
    }

    private async removeStalePlatformInstance(
        platformInstance: PlatformInstance,
    ): Promise<void> {
        if (platformInstance.flaggedForTermination || this.stopTriggered) {
            rmLog(`terminating platform instance ${platformInstance.id}`);
            await platformInstance.shutdown(); // terminate
        } else {
            rmLog(
                `flagging for termination platform instance ${platformInstance.id} (no registered sessions found)`,
            );
            platformInstance.flaggedForTermination = true;
        }
    }

    private socketExists(sessionId: string) {
        for (const socket of this.sockets) {
            if (socket.id === sessionId) {
                return true;
            }
        }
        return false;
    }

    private async delay(ms: number): Promise<void> {
        return await new Promise((resolve) => setTimeout(resolve, ms));
    }

    private async getSockets(): Promise<Array<SocketInstance>> {
        return listener.io.fetchSockets();
    }

    private async performStaleCheck(platformInstance: PlatformInstance) {
        this.removeStaleSocketSessions(platformInstance);
        // Static platforms are for global use, not tied to a unique to session (e.g. credentials)
        if (!platformInstance.global) {
            if (
                (platformInstance.config.persist &&
                    !platformInstance.config.initialized) ||
                platformInstance.sessions.size === 0
            ) {
                // either the platform failed to initialize, or there are no more sessions linked to it
                await this.removeStalePlatformInstance(platformInstance);
            }
        }
    }

    private async clean(): Promise<void> {
        if (this.stopTriggered) {
            this.cycleRunning = false;
            return;
        }
        if (this.cycleRunning) {
            throw new Error(
                "janitor cleanup cycle called while already running",
            );
        }
        this.cycleRunning = true;
        this.cycleCount++;
        this.sockets = await this.getSockets();

        if (!(this.cycleCount % 4)) {
            this.reportCount++;
            rmLog(
                `socket sessions: ${this.sockets.length} platform instances: ${platformInstances.size}`,
            );
        }

        for (const platformInstance of platformInstances.values()) {
            await this.performStaleCheck(platformInstance);
        }
        this.cycleRunning = false;
        await this.delay(this.cycleInterval);
        return this.clean();
    }
}

const janitor = new Janitor();
export default janitor;
