angular.module('twitter', []).

/**
 * Factory: Twitter
 */
factory('Twitter', ['$rootScope', '$q', 'SH', 'configHelper',
function Twitter($rootScope, $q, SH, CH) {
  var config = {
    username: '',
    consumer_key: '',
    consumer_secret: '',
    access_token: '',
    access_token_secret: ''
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
        var cred_tpl = SOCKETHUB_CREDS['twitter']['credentials']['# useraddress #'];
        cred_tpl.access_token = config.access_token;
        cred_tpl.access_token_secret = config.access_token_secret;
        cred_tpl.consumer_key = config.consumer_key;
        cred_tpl.consumer_secret = config.consumer_secret;
        cred_tpl.actor.address = config.username;
        cred_tpl.actor.name = '';

        SH.set('twitter', 'credentials', config.username, cred_tpl).
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
    msg.platform = 'twitter';
    msg.verb = 'post';
    console.log("POST: ", msg);
    SH.submit.call(msg, 5000).then(defer.resolve, defer.reject);
    return defer.promise;
  }

  function fetch(msg) {
    var defer = $q.defer();
    msg.platform = 'twitter';
    msg.verb = 'fetch';
    console.log("FETCH: ", msg);
    SH.submit.call(msg, 5000).then(defer.resolve, defer.reject);
    return defer.promise;
  }

  var feedData = [];

  SH.on('twitter', 'message', function (m) {
    console.log("Twitter received message: ", m);
    feedData.push(m);
  });


  return {
    config: {
      exists: exists,
      set: set,
      data: config
    },
    feeds: {
      data: feedData
    },
    post: post,
    fetch: fetch
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
    }).
    when('/twitter/fetch', {
      templateUrl: 'templates/twitter/fetch.html'
    }).
    when('/twitter/feeds', {
      templateUrl: 'templates/twitter/feeds.html'
    });
}]).


/**
 * directive: twitterNav
 */
directive('twitterNav', [
function () {
  return {
    restrict: 'A',
    template: '<div ng-controller="twitterNavCtrl">' +
              '  <ul class="nav nav-tabs">' +
              '    <li ng-class="navClass(\'twitter\')">' +
              '      <a href="#/twitter">Settings</a>' +
              '    </li>' +
              '    <li ng-class="navClass(\'twitter/post\')">' +
              '      <a href="#/twitter/post">Post</a>' +
              '    </li>' +
              '    <li ng-class="navClass(\'twitter/fetch\')">' +
              '      <a href="#/twitter/fetch">Fetch</a>' +
              '    </li>' +
              '    <li ng-class="navClass(\'twitter/feeds\')">' +
              '      <a href="#/twitter/feeds">Feeds</a>' +
              '    </li>' +
              '  </ul>' +
              '</div>'
  };
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
        text: 'Hello from @sockethub! http://sockethub.org #sockethub'
      }
    }
  };

  $scope.config = Twitter.config;

  $scope.post = function () {
    $scope.sending = true;
    $scope.model.message.actor.address = $scope.config.data.username;
    Twitter.post($scope.model.message).then(function (m) {
      $scope.model.sendMsg = 'twitter post successful!';
      console.log('twitter post successful! reply: ', m);
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
}]).


/**
 * Controller: twitterFetchCtrl
 */
controller('twitterFetchCtrl',
['$scope', '$rootScope', 'Twitter', '$timeout',
function ($scope, $rootScope, Twitter, $timeout) {
  $scope.sending = false;
  $scope.model = {
    sendMsg: '',

    message: {
      actor: {
        address: ''
      },
      target: []
    }
  };

  $scope.config = Twitter.config;

  $scope.addTarget = function () {
    console.log('scope:', $scope);
    $scope.model.message.target.push({address: $scope.model.targetAddress});
    $scope.model.targetAddress = '';
  };

  $scope.fetchTwitter = function () {
    $scope.model.sendMsg = 'fetching feeds...';
    $scope.sending = true;
    $scope.model.message.actor.address = $scope.config.data.username;
    Twitter.fetch($scope.model.message).then(function (data) {
      $scope.model.sendMsg = 'twitter fetch successful!';
      console.log('twitter fetch successful! ', data);
      $scope.sending = false;
      $timeout(function () {
        $scope.model.sendMsg = 'click the feeds tab to view fetched entries';
      }, 2000);
    }, function (err) {
      console.log('twitter fetch failed: ', err);
      $scope.model.sendMsg = err;
      /*$timeout(function () {
        $scope.model.sendMsg = '';
      }, 5000);*/
    });
  };

  $scope.formFilled = function () {
    if ($scope.model.message.target) {
      return true;
    } else {
      return false;
    }
  };

  if ($scope.model.message.target.length === 0) {
    $scope.model.sendMsg = 'first, fill out your credentials in the settings tab';
  } else {
    $scope.model.sendMsg = '';
  }
}]).


/**
 * controller: twitterFeedCtrl
 */
controller('twitterFeedsCtrl',
['$scope', 'Twitter',
function ($scope, Twitter) {
  $scope.feeds = Twitter.feeds.data;
}]).


/**
 * directive: tweets
 */
directive('tweets', [
function () {
  return {
    restrict: 'A',
    scope: {
      feeds: '='
    },
    template: '<div class="well tweets" ng-repeat="t in feeds">' +
              '  <h2>{{ t.actor.name }}</h2>' +
              '  <p><img src="{{ t.actor.image }}" /> <span class="faded">@{{ t.actor.address }}</span></p> ' +
              '  <p>{{ t.object.text }}</p>' +
              '  <p>hashtags:</p><ul><li ng-repeat="t in t.object.tags" class="hashtags"><a target="_blank" href="{{ t }}">{{ t }}</a></li></ul>' +
              '  <p>links:</p><ul><li ng-repeat="l in t.object.urls" class="links"><a target="_blank" href="{{ l }}">{{ l }}</a></li></ul>' +
              '  <div data-brief data-ng-bind-html-unsafe="t.object.brief_html"></div>' +
              '</div>',
    transclude: true
  };
}]);

