remoteStorage.defineModule('email', function(privateClient, publicClient) {
  return {
    exports: {
      getConfig: function(type) {
        console.log(' [remoteStorage.email] getConfig('+type+')');
        return privateClient.getObject(type);
      },

      writeConfig: function(platform, type, data) {
        return privateClient.storeObject('config', type+'/'+platform, data);
      }
    }
  };
});

