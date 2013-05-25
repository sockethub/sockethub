angular.module('rss', []).

/**
 * Factory: RSS
 */
factory('RSS', ['$rootScope', '$q', 'SH', 'configHelper',
function RSS($rootScope, $q, SH, CH) {

  var config = {
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
      defer.resolve(config);
    } else {
      defer.reject('config not set correctly');
    }
    return defer.promise;
  }

  function fetch(msg) {
    var defer = $q.defer();
    msg.platform = 'rss';
    msg.verb = 'fetch';
    console.log("FETCH: ", msg);
    SH.submit(msg, 5000).then(defer.resolve, defer.reject);
    return defer.promise;
  }

  var feedData = [];

  SH.on('rss', 'message', function (m) {
    console.log("RSS received message");
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
    fetch: fetch
  };
}]).


/**
 * config
 */
config(['$routeProvider',
function config($routeProvider) {
  $routeProvider.
    when('/rss', {
      templateUrl: 'templates/rss/fetch.html'
    }).
    when('/rss/feeds', {
      templateUrl: 'templates/rss/feeds.html'
    });
}]).


/**
 * Controller: rssNavCtrl
 */
controller('rssNavCtrl',
['$scope', '$rootScope', '$location',
function rssNavCtrl($scope, $rootScope, $location) {
  $scope.navClass = function (page) {
    var currentRoute = $location.path().substring(1) || 'home';
    return page === currentRoute ? 'active' : '';
  };
}]).


/**
 * Controller: rssSettingsCtrl
 */
controller('rssSettingsCtrl',
['$scope', '$rootScope', 'settings', 'RSS',
function rssSettingsCtrl($scope, $rootScope, settings, RSS) {
  settings.save($scope, RSS);
}]).


/**
 * Controller: rssFetchCtrl
 */
controller('rssFetchCtrl',
['$scope', '$rootScope', 'RSS', '$timeout',
function rssFetchCtrl($scope, $rootScope, RSS, $timeout) {
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

  $scope.config = RSS.config;

  $scope.addTarget = function () {
    console.log('scope:', $scope);
    $scope.model.message.target.push({address: $scope.model.targetAddress});
    $scope.model.targetAddress = '';
  };

  $scope.fetchRSS = function () {
    $scope.model.sendMsg = 'fetching feeds...';
    $scope.sending = true;
    RSS.fetch($scope.model.message).then(function () {
      $scope.model.sendMsg = 'rss fetch successful!';
      console.log('rss fetch successful!');
      $scope.sending = false;
      $timeout(function () {
        $scope.model.sendMsg = 'click the feeds tab to view fetched entries';
      }, 2000);
    }, function (err) {
      console.log('rss fetch failed: ', err);
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
    $scope.model.sendMsg = 'add rss feeds to fetch';
  } else {
    $scope.model.sendMsg = '';
  }
}]).


/**
 * controller: rssFeedCtrl
 */
controller('rssFeedsCtrl',
['$scope', 'RSS',
function rssFeedsCtrl($scope, RSS) {
  $scope.feeds = RSS.feeds.data;
// }]).

// directive('renderArticle', ['$compile',
// function renderArticle($compile) {
//   return {
//     scope: true,
//     link: function (scope, element, attrs) {
//       var el = $compile()
//     }
//   };
}]);