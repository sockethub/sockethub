angular.module('ngSockethubClient', []).


/**
 * settings service
 */
value('settings', {
  sockethub: function () {
    // figure out sockethub connect settings
    var settings = {
      host: 'localhost',
      port: '10550',
      path: '/sockethub',
      tls: false,
      secret: '1234567890'
    };

    return settings;
  },
  save: function (scope, factory) {
    scope.config = factory.config.data;
    scope.model = {};
    scope.model.submitMsg = '';
    scope.save = function () {
      scope.saving = true;
      factory.config.set().then(function () {
        scope.model.submitMsg = 'config saved!';
        scope.saving = false;
      }, function (err) {
        scope.model.submitMsg = err;
      });
    };
  }
}).


/**
 * connect to sockethub on startup
 */
run(['settings', 'SH', '$rootScope',
function (settings, SH, $rootScope) {
  var s = settings.sockethub();
  // connect to sockethub and register
  SH.setConfig(s.host, s.port,
               s.path, s.tls,
               s.secret).then(function () {
    return SH.connect();
  }).then(function () {
    return SH.register();
  }).then(function () {
    console.log('connected to sockethub');
  }, function (err) {
    console.log('error connection to sockethub: ', err);
    $rootScope.$broadcast('SockethubConnectFailed', {message: err});
  });
}]).


/**
 * factory: SH
 */
factory('SH', ['$rootScope', '$q', '$timeout',
function ($rootScope, $q, $timeout) {

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


  function callOnReady(p) {
    var defer = $q.defer();
    (function __call() {
      if (p.testFunc()) {
        console.log('SH: calling: '+p.callFunc);
        sc[p.callFunc].apply(sc, p.callParams)
          .then(function (e) {
            $rootScope.$apply(defer.resolve(e));
          }, function (e) {
            $rootScope.$apply(defer.reject(e));
          });
      } else {
        console.log('SH: delaying call 1s');
        $timeout(__call, 1000);
      }
    })();
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
      console.log('CONNECTED [connected: '+sc.isConnected()+'] [registered: '+sc.isRegistered()+']');
      sc.on('message', function (data) {
        //console.log('SH received message');
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
        if ((data) && (data.platform) &&
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
        defer.reject(err);
      });
    });
    return defer.promise;
  }


  function register() {
    var defer = $q.defer();
    console.log('SH.register() called');
    callOnReady({
      testFunc: isConnected,
      callFunc: 'register',
      callParams: [{
        secret: config.secret
      }]
    }).then(defer.resolve, defer.reject);
    return defer.promise;
  }


  function sendSet(platform, type, index, object) {
    var defer = $q.defer();
    var data = {};
    data[type] = {};
    data[type][index] = object;

    callOnReady({
      testFunc: isRegistered,
      callFunc: 'set',
      callParams: [platform, data]
    }).then(defer.resolve, defer.reject);

    return defer.promise;
  }


  function sendSubmit(obj, timeout) {
    var defer = $q.defer();

    callOnReady({
      testFunc: isRegistered,
      callFunc: 'submit',
      callParams: [obj, timeout]
    }).then(defer.resolve, defer.reject);

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