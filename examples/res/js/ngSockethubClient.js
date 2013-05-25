angular.module('ngSockethubClient', []).
factory('SH', ['$rootScope', '$q',
function ($rootScope, $q) {

  var sc;
  var callbacks = {
    'error': {},
    'message': {},
    'response': {},
    'close': {}
  };

  var config = {
    host: '',
    port: '',
    path: '/sockethub',
    tls: false,
    secret: ''
  };

  function existsConfig() {
    if ((!config.host) && (config.host !== '') &&
        (!config.port) && (config.port !== '') &&
        (!config.path) && (config.path !== '') &&
        (!config.tls) && (config.tls !== '') &&
        (!config.secret) && (config.secret !== '')) {
      return true;
    } else {
      return false;
    }
  }

  function setConfig(host, port, path, tls, secret) {
    var defer = $q.defer();

    console.log('SH.setConfig: '+host+', '+port+', '+path+', TLS:'+tls+', SECRET:'+secret);
    config.host = host;
    config.port = port;
    config.path = path;
    config.tls = tls;
    config.secret = secret;

    defer.resolve();
    return defer.promise;
  }

  function isConnected() {
    if (sc) {
      return sc.isConnected();
    } else {
      return false;
    }
  }

  function isRegistered() {
    if (sc) {
      return sc.isRegistered();
    } else {
      return false;
    }
  }

  function register() {
    var defer = $q.defer();
    sc.register({
      secret: config.secret
    }).then(function () {
      //console.log('ngSockethubClient.register: registration success ['+sc.isConnected()+']');
      $rootScope.$apply(defer.resolve);
    }, function (err) { // sockethub registration fail
      console.log('ngSockethubClient.register: registration failed: ', err);
      $rootScope.$apply(function () {
        defer.reject(err.message);
      });
    });
    return defer.promise;
  }

  function connect() {
    var defer = $q.defer();
    var scheme = 'ws://';
    if (config.tls) {
      scheme = 'wss://';
    }
    SockethubClient.connect({
      host: scheme + config.host + ':' + config.port + config.path,
      confirmationTimeout: 3000   // timeout in miliseconds to wait for confirm
    }).then(function (connection) {
      sc = connection;
      sc.on('message', function (data) {
        console.log('SH received message: ', data);
        if ((data.platform) &&
            (callbacks['message'][data.platform])) {
          console.log('SH passing message to platform: '+data.platform);
          $rootScope.$apply(callbacks['message'][data.platform](data));
        }
      });
      sc.on('error', function (data) {
        console.log('SH received error: ', data);
        if ((data.platform) &&
            (callbacks['error'][data.platform])) {
          console.log('SH passing error to platform: '+data.platform);
          $rootScope.$apply(callbacks['error'][data.platform](data));
        }
      });
      sc.on('response', function (data) {
        console.log('SH received response: ', data);
        if ((data.platform) &&
            (callbacks['response'][data.platform])) {
          console.log('SH passing response to platform: '+data.platform);
          $rootScope.$apply(callbacks['response'][data.platform](data));
        }
      });
      sc.on('close', function (data) {
        console.log('SH received close: ', data);
        if ((data.platform) &&
            (callbacks[close][data.platform])) {
          console.log('SH passing close to platform: '+data.platform);
          $rootScope.$apply(callbacks['close'][data.platform](data));
        }
      });
      $rootScope.$apply(function () {
        defer.resolve();
      });
    }, function (err) { // sockethub connection failed
      $rootScope.$apply(function () {
        //console.log('ngSockethubClient.connect: received error on connect: ', err);
        defer.reject(err);
      });
    });
    return defer.promise;
  }

  function sendSet(platform, type, index, object) {
    var defer = $q.defer();
    var data = {};
    data[type] = {};
    data[type][index] = object;
    sc.set(platform, data).then(function () {
      $rootScope.$apply(function () {
        defer.resolve();
      });
    }, function () {
      $rootScope.$apply(function () {
        defer.reject();
      });
    });

    return defer.promise;
  }

  function sendSubmit(obj, timeout) {
    var defer = $q.defer();

    sc.submit(obj, timeout).then(function () {
      $rootScope.$apply(function () {
        defer.resolve();
      });

    }, function (resp) {
      console.log('ngSockethubClient submit rejection response: ', resp);
      $rootScope.$apply(function () {
        defer.reject(resp.message);
      });
    });

    return defer.promise;
  }

  var on = function on(platform, type, func) {
    callbacks[type][platform] = func;
  };

  return {
    config: config,
    existsConfig: existsConfig,
    setConfig: setConfig,
    connect: connect,
    register: register,
    isConnected: isConnected,
    isRegistered: isRegistered,
    set: sendSet,
    submit: sendSubmit,
    on: on
  };
}]);