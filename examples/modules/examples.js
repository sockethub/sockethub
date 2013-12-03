angular.module('service', []).

/**
 * settings service
 */
value('settings', {
  sockethub: function () {
    // figure out sockethub connect settings
    var settings = {
      host: 'localhost',
      port: 10550,
      path: '/sockethub',
      tls: false,
      secret: '1234567890'
    };

    if (CONNECT) {
      settings.host = CONNECT.HOST;
      settings.port = CONNECT.PORT;
      settings.path = CONNECT.PATH;
      settings.tls = CONNECT.TLS;
      settings.secret = CONNECT.SECRET;
    }
    return settings;
  },
  save: function (scope, factory) {
    scope.config = factory.config.data;
    scope.model = {};
    scope.model.submitMsg = '';
    scope.save = function () {
console.log('!!save called');
      scope.saving = true;
      factory.config.set().then(function () {
        scope.model.submitMsg = 'config saved!';
        scope.saving = false;
      }, function (err) {
        scope.model.submitMsg = err;
      });
    };
  }
}).

value('configHelper', {
  exists: function exists(config, cfg) {
    if (!cfg) {
      cfg = config;
    }

    for (var key in config) {
      if (!cfg[key]) {
        return false;
      }
    }
    return true;
  },
  set: function (config, cfg) {
    for (var key in cfg) {
      config[key] = cfg[key];
    }
    return config;
  }
});


angular.module('examples', ['ngSockethubClient', 'service', 'email', 'twitter', 'facebook', 'feeds', 'irc']).

/**
 * connect to sockethub on startup
 */
run(['settings', 'SH', 'SockethubSettings',
function (settings, SH, SHsettings) {
  var s = settings.sockethub();
  // connect to sockethub and register
  SHsettings.save('conn', s);
  SH.connect().then(function () {
    console.log('connected, registering...');
    return SH.register();
  }).then(function () {
    console.log('connected to sockethub');
  }, function (err) {
    console.log('error connection to sockethub: ', err);
  });
}]).


/**
 * config
 */
config(['$routeProvider',
function ($routeProvider) {
  $routeProvider.
    when('/', {
      templateUrl: 'home.html'
    }).
    when('/email', {
      templateUrl: 'templates/email/settings.html'
    }).
    when('/twitter', {
      templateUrl: 'templates/twitter/settings.html'
    }).
    when('/facebook', {
      templateUrl: 'templates/facebook/settings.html'
    }).
    when('/feeds', {
      templateUrl: 'templates/feeds/fetch.html'
    }).
    when('/irc', {
      templateUrl: 'templates/irc/settings.html'
    }).
    otherwise({
      redirectTo: '/'
    });
}]).


/**
 * filter: urlEncode
 */
filter('urlEncode', [
function() {
  return function (text, length, end) {
    console.log("FILTER: ", text, length, end);
    return encodeURIComponent(text);
  };
}]).


/**
 * controller: navCtrl
 */
controller('navCtrl',
['$scope', '$rootScope', '$location',
function navCtrl($scope, $rootScope, $location) {
  $scope.navClass = function (page) {
    var currentRoute = $location.path().substring(1) || 'home';
    return page === currentRoute.substr(0, page.length) ? 'active' : '';
  };
}]).




////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// DIRECTIVES
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////


/**
 * directive: articles
 */
directive('articles', [
function () {
  return {
    restrict: 'A',
    scope: {
      feeds: '='
    },
    template: '<div class="well" ng-repeat="f in feeds">' +
              '  <h2>{{ f.object.title }}</h2>' +
              '  <p>feed: <i>{{ f.actor.address }}</i></p>' +
              '  <p>article link: <i><a target="_blank" href="{{ f.object.link }}">{{ f.object.link }}</a><i></p>' +
              '  <div data-brief data-ng-bind-html-unsafe="f.object.brief_html"></div>' +
              '</div>',
    link: function (scope) {
      console.log('ARTICLES: ', scope.feeds);
      for (var i = 0, num = scope.feeds.length; i < num; i = i + 1) {
        if (!scope.feeds[i].object.html) {
          scope.feeds[i].object.html = scope.feeds[i].object.text;
        }
        if (!scope.feeds[i].object.brief_html) {
          scope.feeds[i].object.brief_html = scope.feeds[i].object.brief_text;
        }
      }
    }
  };
}]).


/**
 * directive: feedList
 */
directive('feedList', [
function () {
  return {
    restrict: 'A',
    scope: {
      feeds: '='
    },
    template: '<h4 ng-transclude></h4>' +
              '<ul class="nav nav-list">' +
              '  <li ng-repeat="f in uniqueFeeds" data-toggle="tooltip" title="{{ f.address }}">' +
              '    <a href="#/{{f.platform}}/feed/{{ f.address | urlEncode }}">{{ f.name }}</a>' +
              '  </li>' +
              '</ul>',
    link: function (scope, element, attrs) {
      scope.uniqueFeeds = [];
      console.log('**** feeds: ', scope.feeds);

      for (var i = 0, num = scope.feeds.length; i < num; i = i + 1) {
        var match = false;
        for (var j = 0, jnum = scope.uniqueFeeds.length; j < jnum; j = j + 1) {
          if (scope.uniqueFeeds[j].address === scope.feeds[i].actor.address) {
            match = true;
            break;
          }
        }
        if (!match) {
          scope.uniqueFeeds.push({ address: scope.feeds[i].actor.address,
                                   name: scope.feeds[i].actor.name,
                                   description: scope.feeds[i].actor.description,
                                   platform: scope.feeds[i].platform });
        }
      }
      console.log('**** uniqueFeeds: ', scope.uniqueFeeds);
    },
    transclude: true
  };
}]).


/**
 * directive: brief
 */
directive('brief', [
function () {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {
      //console.log('LINK: ', element[0]);
    }
  };
}]);
