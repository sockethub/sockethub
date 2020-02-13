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
            rmLog('sockets: ' + shared_resources_1.default.socketConnections.size +
                ' instances: ' + shared_resources_1.default.platformInstances.size);
        }
        for (let platformInstance of shared_resources_1.default.platformInstances.values()) {
            for (let socketId of platformInstance.sockets.values()) {
                if (!shared_resources_1.default.socketConnections.has(socketId)) {
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
                            shared_resources_1.default.helpers.removePlatform(platformInstance);
                        });
                    }
                    catch (e) {
                        shared_resources_1.default.helpers.removePlatform(platformInstance);
                    }
                }
                else {
                    rmLog(`flagging for termination platform instance ${platformInstance.id} ` +
                        `(no registered sockets found)`);
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