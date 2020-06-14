"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const init_1 = __importDefault(require("./bootstrap/init"));
const shared_resources_1 = __importDefault(require("./shared-resources"));
const platform_instance_1 = __importDefault(require("./platform-instance"));
const common_1 = require("./common");
class ProcessManager {
    constructor(parentId, parentSecret1, parentSecret2) {
        this.parentId = parentId;
        this.parentSecret1 = parentSecret1;
        this.parentSecret2 = parentSecret2;
    }
    register(msg, sessionId) {
        const platformDetails = init_1.default.platforms.get(msg.context);
        if (platformDetails.config.persist) {
            // ensure process is started - one for each actor
            return this.ensureProcess(msg.context, msg.actor['@id'], sessionId);
        }
        else {
            // ensure process is started - one for all jobs
            return this.ensureProcess(msg.context);
        }
    }
    ensureProcess(platform, actor, sessionId) {
        const identifier = common_1.getPlatformId(platform, actor);
        const platformInstance = shared_resources_1.default.platformInstances.get(identifier) ||
            new platform_instance_1.default(identifier, platform, this.parentId);
        platformInstance.registerSession(sessionId);
        platformInstance.process.send({
            type: 'secrets',
            data: {
                parentSecret1: this.parentSecret1,
                parentSecret2: this.parentSecret2
            }
        });
        shared_resources_1.default.platformInstances.set(identifier, platformInstance);
        return identifier;
    }
}
exports.default = ProcessManager;
//# sourceMappingURL=process-manager.js.map