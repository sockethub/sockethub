angular.module('feeds', ['ngRoute']).

/**
 * Factory: Feeds
 */
factory('Feeds', ['$rootScope', '$q', 'SH', 'configHelper',
function ($rootScope, $q, SH, CH) {

  var config = {};

  function exists(cfg) {
    return CH.exists(config, cfg);
  }

  function set(cfg) {
    var defer = $q.defer();
    if (exists(cfg)) {
      if (cfg) {
        CH.set(config, cfg);
      }
      defer.resolve(config);
    } else {
      defer.reject('config not set correctly');
    }
    return defer.promise;
  }

  function fetch(msg) {
    var defer = $q.defer();
    msg.platform = 'feeds';
    msg.verb = 'fetch';
    if (!msg.actor.address) {
      msg.actor.address = "feeds";
    }
    console.log("FETCH: ", msg);
    SH.submit.call(msg, 5000).then(defer.resolve, defer.reject);
    return defer.promise;
  }

  var feedData = [];

  SH.on('feeds', 'message', function (m) {
    console.log("Feeds received message");
    if (m.status) { // just handle successful fetches
      feedData.push(m);
    }
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
    fetch: fetch
  };
}]).


/**
 * config
 */
config(['$routeProvider',
function ($routeProvider) {
  $routeProvider.
    when('/feeds', {
      templateUrl: 'templates/feeds/fetch.html'
    }).
    when('/feeds/feeds', {
      templateUrl: 'templates/feeds/feeds.html'
    }).
    when('/feeds/feed/:address', {
      templateUrl: 'templates/feeds/feeds.html'
    });
}]).


/**
 * directive: feedsNav
 */
directive('feedsNav', [
function () {
  return {
    restrict: 'A',
    template: '<div ng-controller="feedsNavCtrl">' +
              '  <ul class="nav nav-tabs">' +
              '    <li ng-class="navClass(\'feeds\')">' +
              '      <a href="#/feeds">Fetch</a>' +
              '    </li>' +
              '    <li ng-class="navClass(\'feeds/feeds\')">' +
              '      <a href="#/feeds/feeds">Feeds</a>' +
              '    </li>' +
              '  </ul>' +
              '</div>'
  };
}]).


/**
 * Controller: feedsNavCtrl
 */
controller('feedsNavCtrl',
['$scope', '$rootScope', '$location',
function ($scope, $rootScope, $location) {
  $scope.navClass = function (page) {
    var currentRoute = $location.path().substring(1) || 'home';
    return page === currentRoute ? 'active' : '';
  };
}]).


/**
 * Controller: feedsSettingsCtrl
 */
controller('feedsSettingsCtrl',
['$scope', '$rootScope', 'settings', 'Feeds',
function ($scope, $rootScope, settings, Feeds) {
  settings.save($scope, Feeds);
}]).


/**
 * Controller: feedsFetchCtrl
 */
controller('feedsFetchCtrl',
['$scope', '$rootScope', 'Feeds', '$timeout',
function ($scope, $rootScope, Feeds, $timeout) {
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

  $scope.config = Feeds.config;

  $scope.addTarget = function () {
    console.log('targetAddress['+ $scope.model.targetAddress+']');
    $scope.model.message.target.push({address: $scope.model.targetAddress});
    $scope.model.targetAddress = '';
  };

  $scope.fetchFeeds = function () {
    $scope.model.sendMsg = 'fetching feeds...';
    $scope.sending = true;
    Feeds.fetch($scope.model.message).then(function () {
      $scope.model.sendMsg = 'fetch successful!';
      console.log('fetch successful!');
      $scope.sending = false;
      $timeout(function () {
        $scope.model.sendMsg = 'click the feeds tab to view fetched entries';
      }, 2000);
    }, function (err) {
      console.log('fetch failed: ', err);
      $scope.model.sendMsg = err;
      $timeout(function () {
        $scope.model.sendMsg = '';
      }, 5000);
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
    $scope.model.sendMsg = 'add feeds to fetch';
  } else {
    $scope.model.sendMsg = '';
  }
}]).


/**
 * controller: feedsFeedCtrl
 */
controller('feedsCtrl',
['$scope', 'Feeds',
function ($scope, Feeds) {
  $scope.feeds = Feeds.feeds.data;
}]);
