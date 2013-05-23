angular.module('twitter', ['ngSockethubClient', 'service']).

/**
 * Factory: Twitter
 */
factory('Twitter', ['$rootScope', '$q', 'SH',
function Twitter($rootScope, $q, SH) {
  var config = {
    username: '',
    consumer_key: '',
    consumer_secret: '',
    access_token: '',
    access_token_secret: ''
  };

  function exists(cfg) {
    if (!cfg) {
      cfg = config;
    }
    if ((cfg.username) &&
        (cfg.consumer_key) &&
        (cfg.consumer_secret) &&
        (cfg.access_token_secret) &&
        (cfg.access_token)) {
      return true;
    } else {
      console.log('config not set properly');
      return false;
    }
  }

  function set(cfg) {
    var defer = $q.defer();
    if (exists(cfg)) {
      if (cfg) {
        config.username = cfg.username;
        config.consumer_key = cfg.consumer_key;
        config.consumer_secret = cfg.consumer_secret;
        config.access_token = cfg.access_token;
        config.access_token_secret = cfg.access_token_secret;
      }
      if (SH.isConnected()) {
        SH.set('twitter', 'credentials', config.username, {
          username: config.username,
          consumer_key: config.consumer_key,
          consumer_secret: config.consumer_secret,
          access_token: config.access_token,
          access_token_secret: config.access_token_secret
        }).then(function () {
          defer.resolve(config);
        }, defer.reject);
      } else {
        defer.reject('not connected to sockethub');
      }
    } else {
      defer.reject('config not set correctly');
    }

    return defer.promise;
  }

  function post(msg) {
    var defer = $q.defer();
    msg.platform = 'twitter';
    msg.verb = 'post';
    console.log("POST: ", msg);
    SH.submit(msg, 5000).then(defer.resolve, defer.reject);
    return defer.promise;
  }

  return {
    config: {
      exists: exists,
      set: set,
      data: config
    },
    post: post
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
['$scope', '$rootScope', 'settings', 'Twitter',
function twitterSettingsCtrl($scope, $rootScope, settings, Twitter) {
  settings.save($scope, Twitter);
}]).


/**
 * Controller: twitterPostCtrl
 */
controller('twitterPostCtrl',
['$scope', '$rootScope', 'Twitter', '$timeout',
function twitterPostCtrl($scope, $rootScope, Twitter, $timeout) {
  $scope.sending = false;
  $scope.model = {
    sendMsg: '',

    message: {
      actor: {
        address: ''
      },
      target: [],
      object: {
        text: 'Hello from @sockethub! http://sockethub.org #sockethub',
      }
    }
  };

  $scope.config = Twitter.config;

  $scope.post = function () {
    $scope.sending = true;
    $scope.model.message.actor.address = $scope.config.data.username;
    Twitter.post($scope.model.message).then(function () {
      $scope.model.sendMsg = 'twitter post successful!';
      console.log('twitter post successful!');
      $scope.model.message.object.text = '';
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
    if ($scope.model.message.object.text) {
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