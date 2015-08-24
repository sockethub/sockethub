if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

var _fetch = 'fetch', _bluebird;
if (typeof window === 'undefined') {
  _fetch = 'node-fetch';

}

if (typeof Promise === 'undefined') {
  _bluebird = 'bluebird';
}

define([ _bluebird, _fetch ], function (bluebird, fetch, undefined) {
  if ((typeof window === 'object') && (typeof window.fetch === 'function')) {
    fetch = window.fetch;
  }

  var pub = {
    fetch: fetch
  };

  if (typeof Promise === 'undefined') {
    pub.fetch.Promise = bluebird;
  }

  var runFunc = function () { this.result(true); };
  var runFail = function (err) {
    if (err) {
      this.result(false, err);
    } else {
      this.result(false);
    }
  };

  return {
    pub: pub,
    runFunc: runFunc,
    runFail: runFail
  };
});

