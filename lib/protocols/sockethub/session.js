
var Session = {
  promising: require('promising'),
  http: require('http'),
  url: require('url'),
  instances: {}
};

Session.request = function(settings, method, path, mimeType, body) {
  var promise = this.promising();
  var options = this.url.parse(settings.storageInfo.href);
  options.headers = { 'Authorization': 'Bearer ' + settings.bearerToken };
  options.method = method;
  options.path += '/' + path;

  if(mimeType) {
    options.headers['Content-Type'] = mimeType + '; charset=UTF-8';
  }

  var req = this.http.request(options);

  req.on('error', promise.reject);
  req.on('response', function(response) {
    response.setEncoding('utf-8');
    var body = '';
    response.on('data', function(chunk) { body += chunk; });
    response.on('end', function() {
      console.log("HEADERS", response.headers, 'BODY', body)
      promise.fulfill({
        mimeType: response.headers['content-type'].split(';')[0],
        data: body
      });
    });
  });

  if(body) {
    req.write(body);
  }
  req.end();
  return promise;
}

Session.get = function(sid) {
  if(sid in Session.instances) {
    return Session.instances[sid];
  }

  var settings = settings;

  var instance = {
    configure: function(_settings) {
      settings = _settings;
    },

    get: function(module, path) {
      var promise = Session.promising();
      if(! settings) {
        promise.reject("Not configured yet!!!");
      } else {
        return Session.request(settings, 'GET', module + '/' + path).
          then(function(response) {
            if(response.mimeType === 'application/json') {
              return JSON.parse(response.data);
            } else {
              return response;
            }
          });
      }
      return promise;
    },
    
  };

  Session.instances[sid] = instance;

  return instance;

};

module.exports = Session;
