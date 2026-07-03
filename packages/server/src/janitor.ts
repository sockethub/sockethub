import { getRedisConnectionCount } from "@sockethub/data-layer";
import { createLogger } from "@sockethub/logger";
import listener from "./listener.js";
import type PlatformInstance from "./platform-instance.js";
import { platformInstances } from "./platform-instance.js";

const rmLog = createLogger("server:janitor");
const REPORT_CYCLE_MOD = 2; // report every N cycles

export class Janitor {
    cycleInterval = 15000;
    cycleCount = 0; // a counter for each cycleInterval
    reportCount = 0; // number of times a report is printed
    protected stopTriggered = false;
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
        rmLog.debug("initializing");
        void this.runCleanCycle();
        rmLog.info("cleaning cycle started");
    }

    async stop(): Promise<void> {
        this.stopTriggered = true;
        rmLog.info("stopping, terminating all sessions");
        for (const platformInstance of platformInstances.values()) {
            this.removeStaleSocketSessions(platformInstance);
            await this.removeStalePlatformInstance(platformInstance);
            await platformInstance.shutdown();
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
        rmLog.debug(
            `removing ${
                !this.stopTriggered ? "stale " : ""
            }socket session reference ${sessionId} 
          in platform instance ${platformInstance.id}`,
        );
        platformInstance.sessions.delete(sessionId);
        platformInstance.sessionIps.delete(sessionId);
    }

    private async removeStalePlatformInstance(
        platformInstance: PlatformInstance,
    ): Promise<void> {
        if (platformInstance.flaggedForTermination || this.stopTriggered) {
            rmLog.info(`terminating platform instance ${platformInstance.id}`);
            await platformInstance.shutdown(); // terminate
        } else {
            rmLog.debug(
                `flagging for termination platform instance ${platformInstance.id} (no registered sessions found)`,
            );
            platformInstance.flaggedForTermination = true;
        }
    }

    private socketExists(sessionId: string): boolean {
        return this.connectedSocketIds().has(sessionId);
    }

    private async delay(ms: number): Promise<void> {
        return await new Promise((resolve) => setTimeout(resolve, ms));
    }

    /** Live, O(1) map of connected socket ids (socket.io's namespace map). */
    private connectedSocketIds(): ReadonlyMap<string, unknown> {
        return listener.io.sockets.sockets;
    }

    private async performStaleCheck(platformInstance: PlatformInstance) {
        this.removeStaleSocketSessions(platformInstance);
        // Static platforms are for global use, not tied to a unique to session
        // (e.g. a stateful platform where credentials are supplied)
        if (!platformInstance.global) {
            if (
                (platformInstance.config.persist &&
                    !platformInstance.isInitialized()) ||
                platformInstance.sessions.size === 0
            ) {
                // either the platform failed to initialize, or there are no more sessions linked to it
                await this.removeStalePlatformInstance(platformInstance);
            }
        }
    }

    /**
     * Run clean() every cycleInterval in a plain loop. The previous
     * implementation recursed (`return this.clean()`) after the delay, so
     * the promise chain from start() grew by one pending promise per cycle
     * for the lifetime of the process — a slow, unbounded leak.
     */
    private async runCleanCycle(): Promise<void> {
        while (!this.stopTriggered) {
            await this.clean();
            await this.delay(this.cycleInterval);
        }
        this.cycleRunning = false;
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

        if (!(this.cycleCount % REPORT_CYCLE_MOD)) {
            this.reportCount++;
            const redisConnections = await getRedisConnectionCount();
            rmLog.info(
                `socket sessions: ${this.connectedSocketIds().size} platform instances: ${platformInstances.size} redis connections: ${redisConnections}`,
            );
        }

        for (const platformInstance of platformInstances.values()) {
            await this.performStaleCheck(platformInstance);
        }
        this.cycleRunning = false;
    }
}

const janitor = new Janitor();
export default janitor;
