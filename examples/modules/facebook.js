angular.module('facebook', []).

/**
 * Factory: Facebook
 */
factory('Facebook', ['$rootScope', '$q', 'SH', 'configHelper',
function Facebook($rootScope, $q, SH, CH) {
  var config = {
    username: '',
    access_token: ''
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
        SH.set('facebook', 'credentials', config.username, config).
          then(function () {
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
    msg.platform = 'facebook';
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
    when('/facebook', {
      templateUrl: 'templates/facebook/settings.html'
    }).
    when('/facebook/post', {
      templateUrl: 'templates/facebook/post.html'
    }).
    when('/facebook/fetch', {
      templateUrl: 'templates/facebook/fetch.html'
    });
}]).


/**
 * Controller: facebookNavCtrl
 */
controller('facebookNavCtrl',
['$scope', '$rootScope', '$location',
function facebookNavCtrl($scope, $rootScope, $location) {
  $scope.navClass = function (page) {
    var currentRoute = $location.path().substring(1) || 'home';
    return page === currentRoute ? 'active' : '';
  };
}]).


/**
 * Controller: facebookSettingsCtrl
 */
controller('facebookSettingsCtrl',
['$scope', '$rootScope', 'settings', 'Facebook',
function facebookSettingsCtrl($scope, $rootScope, settings, Facebook) {
  settings.save($scope, Facebook);
}]).


/**
 * Controller: facebookPostCtrl
 */
controller('facebookPostCtrl',
['$scope', '$rootScope', 'Facebook', '$timeout',
function facebookPostCtrl($scope, $rootScope, Facebook, $timeout) {
  $scope.sending = false;
  $scope.model = {
    sendMsg: '',

    message: {
      actor: {
        address: ''
      },
      target: [],
      object: {
        text: 'Hello from @sockethub! http://sockethub.org',
      }
    }
  };

  $scope.config = Facebook.config;

  $scope.post = function () {
    $scope.sending = true;
    $scope.model.message.actor.address = $scope.config.data.username;
    Facebook.post($scope.model.message).then(function () {
      $scope.model.sendMsg = 'facebook post successful!';
      console.log('facebook post successful!');
      $scope.model.message.object.text = '';
      $scope.sending = false;
      $timeout(function () {
        $scope.model.sendMsg = 'fill out form to make a facebook post';
      }, 5000);

    }, function (err) {
      console.log('facebook post failed: ', err);
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
    $scope.model.sendMsg = 'fill out form to make a facebook post';
  } else {
    $scope.model.sendMsg = 'you must complete the settings in order to post to facebook';
  }
}]);