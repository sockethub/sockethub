var Q = require('q');
var https = require('https');
var http = require('http');
var url = require('url');


function RemoteStorage(cfg) {
  this.options = url.parse(cfg.storageInfo.href);
  this.options.headers = { 'Authorization': 'Bearer ' + cfg.bearerToken };
}

function onResponse(q, res) {
  console.debug(' [remotestorage] HTTP request response');
  // console.log('STATUS: ' + res.statusCode);
  // console.log('HEADERS: ' + JSON.stringify(res.headers));
  res.setEncoding('utf8');
  var body = '';
  res.on('data', function(chunk) { body += chunk; });
  res.on('end', function() {
    q.resolve({
      mimeType: res.headers['content-type'].split(';')[0],
      data: body
    });
  });
}

RemoteStorage.prototype.request = function (method, path) {
  var q = Q.defer();

  this.options.method = method;
  if (path.charAt(0) === '/') {
    this.options.path += path;
  } else {
    this.options.path += '/' + path;
  }

  // if (this.options.mimeType) {
  //   this.options.headers['Content-Type'] = p.mimeType + '; charset=UTF-8';
  // }

  console.debug(' [remotestorage] HTTP ' + method + ' options: ' + JSON.stringify(this.options));


  var _this = this;
  var req;

  try {
    if (this.options.protocol === 'http:') {
      req = http.get(this.options, onResponse.bind(this, q));
    } else {
      req = https.get(this.options, onResponse.bind(this, q));
    }
  } catch (e) {
    console.error(' [session:' + this.platform + '] error with request: ' + e);
    q.reject(e);
    return q.promise;
  }

  req.on('error', function (e) {
    console.error(' [session:' + _this.platform + '] request caught error: ' + e);
    q.reject(e);
  });

  req.end();

  return q.promise;
};


module.exports = RemoteStorage;