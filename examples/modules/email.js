angular.module('email', []).

/**
 * Factory: Email
 */
factory('Email', ['$rootScope', '$q', 'SH',
function Email($rootScope, $q, SH) {
  var config = {
    emailAddress: '',
    username: '',
    password: '',
    smtpServer: ''
  };

  function exists(cfg) {
    if (!cfg) {
      cfg = config;
    }
    if ((cfg.emailAddress) &&
        (cfg.username) &&
        (cfg.password) &&
        (cfg.smtpServer)) {
      return true;
    } else {
      return false;
    }
  }

  function set(cfg) {
    var defer = $q.defer();
    if (exists(cfg)) {
      config.emailAddress = cfg.emailAddress;
      config.username = cfg.username;
      config.password = cfg.password;
      config.smtpServer = cfg.smtpServer;

      if (SH.isConnected()) {
        SH.set('email', 'credentials', config.emailAddress, {
          smtp: {
            username: config.username,
            password: config.password,
            smtpServer: config.smtpServer
          }
        }).then(function () {
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
    SH.submit(msg, 5000).then(defer.resolve, defer.reject);
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
['$scope', '$rootScope', 'Email',
function emailSettingsCtrl($scope, $rootScope, Email) {
  $scope.save = function () {
    $scope.saving = true;
    Email.config.set($scope.config).then(function () {
     $scope.saving = false;
    });
  };
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
      console.log('email failed: ', err);
      $scope.model.sendMsg = err;
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