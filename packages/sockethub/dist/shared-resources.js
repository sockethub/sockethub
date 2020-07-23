"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SharedResources = {
    // collection of platform instances, stored by `id`
    platformInstances: (() => new Map())(),
    // collection of socket instances (referred to internally as session),
    // stored as `socket.id` from socket.io
    sessionConnections: (() => new Map())(),
    helpers: {
        removePlatform: function (platformInstance) {
            SharedResources.platformInstances.delete(platformInstance.id);
            platformInstance.process.removeAllListeners('close');
            try {
                platformInstance.process.unref();
                platformInstance.process.kill();
            }
            catch (e) {
                console.log(e);
            }
        }
    }
};
exports.default = SharedResources;
//# sourceMappingURL=shared-resources.js.map