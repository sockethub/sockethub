angular.module('irc', []).

/**
 * Factory: IRC
 */
factory('IRC', ['$rootScope', '$q', 'SH', 'configHelper',
function IRC($rootScope, $q, SH, CH) {
  var config = {
    server: '',
    nick: '',
    password: '',
    channels: []
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
        var cred_tpl = SOCKETHUB_CREDS.irc.credentials['# nickname #'];
        cred_tpl.nick = config.nick;
        cred_tpl.password = config.password;
        cred_tpl.server = config.server;

        SH.set('irc', 'credentials', config.nick, cred_tpl).then(function () {
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

  function send(msg) {
    var defer = $q.defer();
    msg.platform = 'irc';
    msg.verb = 'send';
    console.log("SENDING: ", msg);
    SH.submit(msg, 5000).then(function (resp) {
      if (resp.status) {
        defer.resolve(resp);
      } else {
        defer.reject(resp);
      }
    });
    return defer.promise;
  }

  return {
    config: {
      exists: exists,
      set: set,
      data: config
    },
    send: send
  };
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
  settings.save($scope, IRC);
}]).


/**
 * Controller: ircSendCtrl
 */
controller('ircSendCtrl',
['$scope', '$rootScope', 'IRC', '$timeout',
function emailSendCtrl($scope, $rootScope, IRC, $timeout) {
  $scope.sending = false;
  $scope.model = {
    targetAddress: '',
    sendMsg: '',

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

  $scope.config = IRC.config;

  $scope.addTarget = function () {
    console.log('scope:', $scope);
    $scope.model.message.target.push({address: $scope.model.targetAddress});
    $scope.model.targetAddress = '';
  };

  $scope.sendIRC = function () {
    $scope.sending = true;
    $scope.model.message.actor.address = $scope.config.data.nick;
    IRC.send($scope.model.message).then(function () {
      $scope.model.sendMsg = 'irc message sent!';
      console.log('irc message sent!');
      $scope.model.targetAddress = '';
      $scope.model.message.target = [];
      $scope.model.message.object.text = '';
      $scope.sending = false;
      $timeout(function () {
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
    if (($scope.model.message.target.length > 0) &&
        ($scope.model.message.object.text)) {
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