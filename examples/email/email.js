angular.module('emailExample', ['ngSockethubClient']).

/**
 * Factory: Email
 */
factory('Email', ['$rootScope', '$q', 'SH',
function ($rootScope, $q, SH) {
  console.log('email factory');

  // connect to sockethub and register
  SH.setConfig('localhost', '10550', '1234567890').then(function () {
    return SH.connect();
  }).then(function () {
    return SH.register();
  }).then(function () {
    console.log('connected to sockethub');
  }, function (err) {
    console.log('error connection to sockethub: ', err);
  });

  var config = {
    emailAddress: '',
    username: '',
    password: '',
    host: ''
  };

  function exists(cfg) {
    if (!cfg) {
      cfg = config;
    }
    if ((cfg.emailAddress) &&
        (cfg.username) &&
        (cfg.password) &&
        (cfg.host)) {
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
      config.host = cfg.host;

      if (SH.isConnected()) {
        SH.set('email', 'credentials', config.emailAddress, {
          smtp: {
            username: config.username,
            password: config.password,
            host: config.host
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
config(function () {}).



/**
 * emitters
 */
run(['$rootScope',
function ($rootScope) {

  $rootScope.$on('showModalSettingsEmail', function(event, args) {
    backdrop_setting = true;
    if ((typeof args === 'object') && (typeof args.locked !== 'undefined')) {
      if (args.locked) {
        backdrop_setting = "static";
      }
    }
    console.log('backdrop: ' + backdrop_setting);
    $("#modalSettingsEmail").modal({
      show: true,
      keyboard: true,
      backdrop: backdrop_setting
    });
  });

  $rootScope.$on('closeModalSettingsEmail', function(event, args) {
    $("#modalSettingsEmail").modal('hide');
  });

}]).



/**
 * Controller: navCtrl
 */
controller('navCtrl',
['$scope', '$rootScope',
function navCtrl($scope, $rootScope) {
  $scope.popup = {};
  $scope.popup.emailSettings = function () {
    $rootScope.$broadcast('showModalSettingsEmail', { locked: false });
  };
}]).



/**
 * Controller: settingsCtrl
 */
controller('settingsCtrl',
['$scope', '$rootScope', 'Email',
function settingsCtrl($scope, $rootScope, Email) {

  $scope.save = function () {
    $scope.saving = true;
    Email.config.set($scope.config).then(function () {
     $scope.saving = false;
     $rootScope.$broadcast('closeModalSettingsEmail');
    });
  };

}]).



/**
 * Controller: emailCtrl
 */
controller('emailCtrl',
['$scope', '$rootScope', 'Email', '$timeout',
function emailCtrl($scope, $rootScope, Email, $timeout) {
  console.log('email controller');

  $scope.sending = false;
  $scope.model = {
    targetAddress: '',
    sendMsg: 'fill out form to send',

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
  console.log('model.message.actor.address', $scope.model.message.actor.address);

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
        $scope.model.sendMsg = '';
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

  if (!$scope.config.exists()) {
    $rootScope.$broadcast('showModalSettingsEmail', {locked: true});
  }

}]);