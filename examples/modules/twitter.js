angular.module('twitter', ['ngSockethubClient']).

/**
 * Factory: Twitter
 */
factory('Twitter', ['$rootScope', '$q', 'SH',
function Twitter($rootScope, $q, SH) {

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
    console.log('email config exists? ',cfg);
    if ((cfg.emailAddress) &&
        (cfg.username) &&
        (cfg.password) &&
        (cfg.smtpServer)) {
      console.log('YES');
      return true;
    } else {
      console.log('NO');
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
    when('/twitter', {
      templateUrl: 'templates/twitter/settings.html'
    }).
    when('/twitter/post', {
      templateUrl: 'templates/twitter/post.html'
    });
}]).


/**
 * Controller: twitterNavCtrl
 */
controller('twitterNavCtrl',
['$scope', '$rootScope', '$location',
function twitterNavCtrl($scope, $rootScope, $location) {
  $scope.navClass = function (page) {
    var currentRoute = $location.path().substring(1) || 'home';
    return page === currentRoute ? 'active' : '';
  };
}]).


/**
 * Controller: twitterSettingsCtrl
 */
controller('twitterSettingsCtrl',
['$scope', '$rootScope', 'Twitter',
function twitterSettingsCtrl($scope, $rootScope, Twitter) {
  $scope.save = function () {
    $scope.saving = true;
    Twitter.config.set($scope.config).then(function () {
     $scope.saving = false;
    });
  };
}]).


/**
 * Controller: twitterSendCtrl
 */
controller('twitterSendCtrl',
['$scope', '$rootScope', 'Twitter', '$timeout',
function twitterSendCtrl($scope, $rootScope, Twitter, $timeout) {
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

  $scope.config = Twitter.config;

  $scope.post = function () {
    $scope.sending = true;
    $scope.model.message.actor.address = $scope.config.data.emailAddress;
    Twitter.post($scope.model.message).then(function () {
      $scope.model.sendMsg = 'twitter post successful!';
      console.log('twitter post successful!');
      $scope.model.targetAddress = '';
      $scope.model.message.target = [];
      $scope.model.message.object.subject = '';
      $scope.model.message.object.text = '';
      $scope.model.message.object.html = '';
      $scope.sending = false;
      $timeout(function () {
        $scope.model.sendMsg = 'fill out form to make a twitter post';
      }, 5000);

    }, function (err) {
      console.log('twitter post failed: ', err);
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
    $scope.model.sendMsg = 'fill out form to make a twitter post';
  } else {
    $scope.model.sendMsg = 'you must complete the settings in order to post to twitter';
  }
}]);