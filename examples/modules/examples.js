angular.module('service', []).

/**
 * settings service
 */
value('settings', {
  sockethub: function () {
    // figure out sockethub connect settings
    var settings = {
      host: 'localhost',
      port: '10550',
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
  }
});


angular.module('examples', ['ngSockethubClient', 'service', 'email', 'twitter']).

/**
 * connect to sockethub on startup
 */
run(['settings', 'SH',
function (settings, SH) {
  var s = settings.sockethub();
  // connect to sockethub and register
  SH.setConfig(s.host, s.port,
               s.path, s.tls,
               s.secret).then(function () {
    return SH.connect();
  }).then(function () {
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
    otherwise({
      redirectTo: '/'
    });
}]).


/**
 * Controller: navCtrl
 */
controller('navCtrl',
['$scope', '$rootScope', '$location',
function navCtrl($scope, $rootScope, $location) {
  $scope.navClass = function (page) {
    var currentRoute = $location.path().substring(1) || 'home';
    return page === currentRoute.substr(0, page.length) ? 'active' : '';
  };
}]);