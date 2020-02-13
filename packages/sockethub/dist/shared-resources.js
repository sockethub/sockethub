"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SharedResources = {
    // collection of platform instances, stored by `uid`
    platformInstances: (() => new Map())(),
    // collection of socket instances, stored by `socket.id`
    socketConnections: (() => new Map())(),
    // mappings between actor `uri` and platform instance `uid`
    platformMappings: (() => new Map())(),
    helpers: {
        removePlatform: function (platformInstance) {
            SharedResources.platformMappings.delete(platformInstance.actor['@id']);
            SharedResources.platformInstances.delete(platformInstance.id);
        }
    }
};
exports.default = SharedResources;
//# sourceMappingURL=shared-resources.js.map