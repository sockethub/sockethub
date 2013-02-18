remoteStorage.defineModule('email', function(privateClient, publicClient) {
  return {
    exports: {
      init: function() {
        privateClient.release('');
        publicClient.release('');
      },

      getConfig: function(type) {
        console.log(' [remoteStorage.email] getConfig('+type+')');
        return privateClient.getObject(type);
      },

      writeConfig: function(type, data) {//type is probably 'credentials' here
        return privateClient.storeObject(type, type, data);
      }
    }
  };
});

