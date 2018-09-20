const SR = {
  // collection of platform instances, stored by `uid`
  platformInstances: (() => new Map())(),
  // collection of socket instances, stored by `socket.id`
  socketConnections: (() => new Map())(),
  // mappings between actor `uri` and platform instance `uid`
  platformMappings: (() => new Map())(),
  helpers: {
    removePlatform: function (platformInstance) {
      SR.platformMappings.delete(platformInstance.actor['@id']);
      SR.platformInstances.delete(platformInstance.id);
    }
  }
};
module.exports = SR;
