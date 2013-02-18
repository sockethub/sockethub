
remoteStorage.defineModule('sockethub', function(privateClient, publicClient) {
  return {
    exports: {
      getConfig: function(platform, type) {
        console.log(' [RS] getConfig('+platform+', '+type+')');
        return privateClient.getObject(type+'/'+platform);
      },

      writeConfig: function(platform, type, data) {
        return privateClient.storeObject('config', type+'/'+platform, data);
      }
    }
  };
});
