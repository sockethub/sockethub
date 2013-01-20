
window.addEventListener('load', function() {

  remoteStorage.defineModule('messages', function(privateClient, publicClient) {
    return {
      exports: {

        getConfig: function(type) {
          return privateClient.getObject('.' + type);
        },

        writeConfig: function(type, config) {
          return privateClient.storeObject('config', '.' + type, config);
        }

      }
    };
  });

  remoteStorage.claimAccess({
    messages: 'rw'
  }).then(function() {
    remoteStorage.displayWidget('remotestorage-connect');
  });

  // XMPP CONFIG

  var configForm = document.getElementById('config-form');

  configForm.source.setAttribute('disabled', 'disabled');

  var xmppConfig;

  configForm.addEventListener('submit', function(event) {
    event.preventDefault();
    try {
      var config = JSON.parse(configForm.source.value);
    } catch(err) {
      configForm.message.value = "Invalid JSON: " + err;
      return;
    };

    remoteStorage.messages.writeConfig('xmpp', config).
      then(function() {
        configForm.message.value = "Saved!";
        xmppConfig = config;
      });
  });

  var configTemplate = { accounts: { '<jid>': { password: '<password>' } } };

  remoteStorage.onWidget('ready', function() {
    remoteStorage.messages.getConfig('xmpp').then(function(config) {
      configForm.source.value = JSON.stringify(config || configTemplate, undefined, 2);
      if(config) {
        xmppConfig = config;
      }
      configForm.source.removeAttribute('disabled');
    });
  });

  // SOCKETHUB

  var socket = null;
  var socketLog = document.getElementById('socket-log');

  var sockethubForm = document.getElementById('sockethub-form');
  sockethubForm.addEventListener('submit', function(event) {
    event.preventDefault();

    socket = new WebSocket(sockethubForm.uri.value, 'sockethub');
    socket.onopen = function() {
      sockethubForm.message.value = "Socket open";
    };
    socket.onclose = function() {
      sockethubForm.message.value = "Socket closed";
      socket = undefined;
    };
    socket.onmessage = function(message) {
      var line = document.createTextNode(message.data + '\n');
      socketLog.appendChild(line);
    };
  });

  sockethubForm.register.addEventListener('click', function(event) {
    event.preventDefault();
    if(! socket) {
      alert("You need to connect the socket first");
    }
    var message = {
      rid: 'register-0001',
      verb: 'register',
      platform: 'dispatcher',
      object: {
        remoteStorage: {
          storageInfo: remoteStorage.getStorageInfo(),
          bearerToken: remoteStorage.getBearerToken(),
          scope: remoteStorage.claimedModules
        },
        secret: 'TODO'
      }
    };

    if(! message.object.remoteStorage.bearerToken) {
      alert("You need to connect to your storage first!");
    } else {
      var rawMessage = JSON.stringify(message);
      socket.send(rawMessage);
    }
  });
  // SEND MESSAGE

  var messageForm = document.getElementById('message-form');
  var mid = 0;
  messageForm.addEventListener('submit', function(event) {
    event.preventDefault();
    if(! socket) {
      alert("You need to connect the socket first");
    }

    socket.send(JSON.stringify({
      rid: 'xmpp-message-' + (++mid),
      platform: 'xmpp',
      verb: 'message',
      actor: {
        address: messageForm.from.value
      },
      target: {
        address: messageForm.to.value
      },
      object: {
        text: messageForm.text.value
      }
    }));
  });

});


