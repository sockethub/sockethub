"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
const shared_resources_1 = __importDefault(require("./shared-resources"));
const rmLog = debug_1.default('sockethub:resource-manager');
let alreadyCalled = false;
let cycleCount = 0;
let reportCount = 0;
function resourceManagerCycle() {
    if (!alreadyCalled) {
        alreadyCalled = true;
    }
    else {
        return;
    }
    rmLog('initializing resource manager');
    setInterval(() => {
        cycleCount++;
        const mod = cycleCount % 4;
        if (!mod) {
            reportCount++;
            rmLog('sessions: ' + shared_resources_1.default.sessionConnections.size +
                ' instances: ' + shared_resources_1.default.platformInstances.size);
        }
        for (let platformInstance of shared_resources_1.default.platformInstances.values()) {
            for (let sessionId of platformInstance.sessions.values()) {
                if (!shared_resources_1.default.sessionConnections.has(sessionId)) {
                    rmLog('removing stale session reference ' + sessionId + ' in platform instance '
                        + platformInstance.id);
                    platformInstance.sessions.delete(sessionId);
                }
            }
            if (platformInstance.global) {
                // static platform for global use, don't do resource management
                continue;
            }
            else if (platformInstance.sessions.size <= 0) {
                if (platformInstance.flaggedForTermination) {
                    // terminate
                    rmLog(`terminating platform instance ${platformInstance.id} ` +
                        `(flagged for termination: no registered sessions found)`);
                    shared_resources_1.default.helpers.removePlatform(platformInstance);
                }
                else {
                    rmLog(`flagging for termination platform instance ${platformInstance.id} ` +
                        `(no registered sessions found)`);
                    platformInstance.flaggedForTermination = true;
                }
            }
            else {
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
exports.default = ResourceManager;
//# sourceMappingURL=resource-manager.js.map