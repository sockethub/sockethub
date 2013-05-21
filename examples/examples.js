console.log('hello world');
var examples = angular.module('examples', ['ngSockethubClient']).


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
      templateUrl: 'email/index.html'
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