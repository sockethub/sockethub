angular.module('email', ['ngRoute']).

/**
 * Factory: Email
 */
factory('Email', ['$rootScope', '$q', 'SH', 'configHelper',
function Email($rootScope, $q, SH, CH) {
  var config = {
    emailAddress: '',
    username: '',
    password: '',
    smtpServer: ''
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
        var cred_tpl = SOCKETHUB_CREDS.email;
        cred_tpl.object.username = config.username;
        cred_tpl.actor.address = config.username;
        cred_tpl.object.password = config.password;
        cred_tpl.object.host = config.smtpServer;

        SH.submit.call(cred_tpl).then(function () {
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
    msg.platform = 'email';
    msg.verb = 'send';
    console.log("SENDING: ", msg);
    SH.submit.call(msg, 5000).then(function (resp) {
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
    when('/email', {
      templateUrl: 'templates/email/settings.html'
    }).
    when('/email/send', {
      templateUrl: 'templates/email/send.html'
    });
}]).


/**
 * directive: emailNav
 */
directive('emailNav', [
function () {
  return {
    restrict: 'A',
    template: '<div ng-controller="emailNavCtrl">' +
              '  <ul class="nav nav-tabs">' +
              '    <li ng-class="navClass(\'email\')">' +
              '      <a href="#/email">Settings</a>' +
              '    </li>' +
              '    <li ng-class="navClass(\'email/send\')">' +
              '      <a href="#/email/send">Send</a>' +
              '    </li>' +
              '  </ul>' +
              '</div>'
  };
}]).


/**
 * Controller: emailNavCtrl
 */
controller('emailNavCtrl',
['$scope', '$rootScope', '$location',
function emailNavCtrl($scope, $rootScope, $location) {
  $scope.navClass = function (page) {
    var currentRoute = $location.path().substring(1) || 'home';
    return page === currentRoute ? 'active' : '';
  };
}]).


/**
 * Controller: emailSettingsCtrl
 */
controller('emailSettingsCtrl',
['$scope', '$rootScope', 'settings', 'Email',
function emailSettingsCtrl($scope, $rootScope, settings, Email) {
  settings.save($scope, Email);
}]).


/**
 * Controller: emailSendCtrl
 */
controller('emailSendCtrl',
['$scope', '$rootScope', 'Email', '$timeout',
function emailSendCtrl($scope, $rootScope, Email, $timeout) {
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
        subject: '',
        text: 'Hello from Sockethub!',
        html: ''
      }
    }
  };

  $scope.config = Email.config;

  $scope.addTarget = function () {
    console.log('scope:', $scope);
    $scope.model.message.target.push({address: $scope.model.targetAddress});
    $scope.model.targetAddress = '';
  };

  $scope.sendEmail = function () {
    $scope.sending = true;
    $scope.model.message.actor.address = $scope.config.data.emailAddress;
    Email.send($scope.model.message).then(function () {
      $scope.model.sendMsg = 'email successfully sent!';
      console.log('email successfully sent!');
      $scope.model.targetAddress = '';
      $scope.model.message.target = [];
      $scope.model.message.object.subject = '';
      $scope.model.message.object.text = '';
      $scope.model.message.object.html = '';
      $scope.sending = false;
      $timeout(function () {
        $scope.model.sendMsg = 'fill out form to send an email message';
      }, 5000);

    }, function (err) {
      console.log('email failed: ', err.message);
      $scope.model.sendMsg = err.message;
      $timeout(function () {
        $scope.model.sendMsg = '';
      }, 5000);
    });
  };

  $scope.formFilled = function () {
    if (($scope.model.message.target.length > 0) &&
        ($scope.model.message.object.subject) &&
        ($scope.model.message.object.text)) {
      return true;
    } else {
      return false;
    }
  };

  if ($scope.config.exists()) {
    $scope.model.sendMsg = 'fill out form to send an email message';
  } else {
    $scope.model.sendMsg = 'you must fill in your settings in order to send an email';
  }
}]);