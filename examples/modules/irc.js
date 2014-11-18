angular.module('irc', ['ngRoute']).

/**
 * Factory: IRC
 */
factory('IRC', ['$rootScope', '$q', 'SH', 'configHelper',
function IRC($rootScope, $q, SH, CH) {
  var config = {
    server: 'irc.freenode.net',
    nick: '',
    channel: '',
    secure: true,
    port: 6697
  };

  function exists(cfg) {
    return CH.exists(config, cfg);
  }


  function set(cfg) {
    var defer = $q.defer();
    if (exists(cfg)) {
      if (cfg) {
        CH.set(config, cfg);
      }

      if (SH.isConnected()) {
        var cred_tpl = SOCKETHUB_CREDS.irc;
        cred_tpl.actor.address = config.nick;
        cred_tpl.actor.name = '';
        cred_tpl.object.nick = config.nick;
        cred_tpl.object.password = config.password || '';
        cred_tpl.object.server = config.server;
        cred_tpl.object.secure = (typeof config.secure === 'boolean') ? config.secure : true;
        cred_tpl.object.port = config.port;// || (cred_tpl.object.secure) ? 6697 : 6667;

        if (config.channel.indexOf('#') < 0) {
          config.channel = '#' + config.channel;
        }
        //cred_tpl.channels = [config.channel];

        SH.submit.call(cred_tpl).then(function () {
          return SH.submit.call({
            verb: 'join',
            platform: 'irc',
            actor: { address: config.nick },
            target: [{address: config.channel }],
            object: {}
          });
        }).then(function (){
          defer.resolve(config);
        }, defer.reject);
      } else {
        defer.reject('not connected to sockethub');
      }
    } else {
      defer.reject();
    }
    return defer.promise;
  }


  var o = {};
  o.connect = function connect() {
    var defer = $q.defer();
    var msg = {
      actor: {
        address: config.nick
      },
      target: [],
      object: {},
      platform: 'irc',
      verb: 'update'
    };
    console.log("SENDING (update): ", msg);
    SH.submit.call(msg, 5000).then(function (resp) {
      if (resp.status) {
        defer.resolve(resp);
      } else {
        defer.reject(resp);
      }
    });
    return defer.promise;
  };


  o.send = function send(msg) {
    var defer = $q.defer();
    msg.platform = 'irc';
    msg.verb = 'send';
    console.log("SENDING (send): ", msg);
    SH.submit.call(msg, 5000).then(function (resp) {
      if (resp.status) {
        defer.resolve(resp);
      } else {
        defer.reject(resp);
      }
    });
    return defer.promise;
  };

  o.console = {
    messages: '-- sockethub irc example --'
  };
  SH.on('irc', 'message', function (m) {
    console.log('irc message received: ', m);
    o.console.messages = o.console.messages + '\n' + m.actor.address +
                                                    ': ' + m.object.text;
  });

  o.config = {
    exists: exists,
    set: set,
    data: config
  };
  return o;
}]).


/**
 * config
 */
config(['$routeProvider',
function config($routeProvider) {
  $routeProvider.
    when('/irc', {
      templateUrl: 'templates/irc/settings.html'
    }).
    when('/irc/chat', {
      templateUrl: 'templates/irc/chat.html'
    });
}]).


/**
 * directive: ircNav
 */
directive('ircNav', [
function () {
  return {
    restrict: 'A',
    template: '<div ng-controller="ircNavCtrl">' +
              '  <ul class="nav nav-tabs">' +
              '    <li ng-class="navClass(\'irc\')">' +
              '      <a href="#/irc">Settings</a>' +
              '    </li>' +
              '    <li ng-class="navClass(\'irc/chat\')">' +
              '      <a href="#/irc/chat">Chat</a>' +
              '    </li>' +
              '  </ul>' +
              '</div>'
  };
}]).


/**
 * Controller: ircNavCtrl
 */
controller('ircNavCtrl',
['$scope', '$rootScope', '$location',
function ircNavCtrl($scope, $rootScope, $location) {
  $scope.navClass = function (page) {
    var currentRoute = $location.path().substring(1) || 'home';
    return page === currentRoute ? 'active' : '';
  };
}]).


/**
 * Controller: ircSettingsCtrl
 */
controller('ircSettingsCtrl',
['$scope', '$rootScope', 'settings', 'IRC',
function ircSettingsCtrl($scope, $rootScope, settings, IRC) {
console.log('ircSettingsCtrl called!');
  settings.save($scope, IRC);
}]).


/**
 * Controller: ircChatCtrl
 */
controller('ircChatCtrl',
['$scope', '$rootScope', 'IRC', '$timeout',
function ircChatCtrl($scope, $rootScope, IRC, $timeout) {
  $scope.sending = false;
  $scope.model = {
    targetAddress: '',
    sendMsg: '',
    channel: '',
    message: {
      actor: {
        address: ''
      },
      target: [],
      object: {
        text: 'Hello from Sockethub!'
      }
    }
  };

  $scope.console = IRC.console;
  $scope.config = IRC.config;
  $scope.connect = IRC.connect;


  $scope.sendMessage = function () {
    $scope.sending = true;
    $scope.model.message.target.push({address: $scope.config.data.channel});
    $scope.model.message.actor.address = $scope.config.data.nick;
    IRC.send($scope.model.message).then(function () {
      $scope.model.sendMsg = 'irc message sent!';
      console.log('irc message sent!');
      $scope.console.messages = $scope.console.messages + '\n<' + $scope.config.data.nick +
                                                    '> ' + $scope.model.message.object.text;
      $scope.sending = false;
      $scope.model.message.target = [];
      $scope.model.message.object.text = '';      $timeout(function () {
        $scope.model.sendMsg = 'fill out form to send an irc message';
      }, 5000);

    }, function (err) {
      console.log('irc message failed: ', err.message);
      $scope.model.sendMsg = err.message;
      $timeout(function () {
        $scope.model.sendMsg = '';
      }, 5000);
    });
  };

  $scope.formFilled = function () {
    if ($scope.model.message.object.text) {
      return true;
    } else {
      return false;
    }
  };

  if ($scope.config.exists()) {
    $scope.model.sendMsg = 'fill out form to send an irc message';
  } else {
    $scope.model.sendMsg = 'you must fill in your settings in order to send an irc message';
  }
}]);
