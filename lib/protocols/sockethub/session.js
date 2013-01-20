
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

// Remove the session with the given session ID.
Session.destroy = function(sid) {
  var session = Session.instances[sid];
  if(session) {
    // cleanup session contents manually, so in case a reference to
    // the session keeps lingering somewhere (which it shouldn't!),
    // at least there remains no compromising information (bearerToken)
    // in memory.
    session.reset();
  }
  delete Session.instances[sid];
  console.log('[session] Destroyed #' + sid + '.');
};

// Get the session instance for the given session ID.
// If the session doesn't exist yet, a new one will be created.
Session.get = function(sid) {
  if(sid in Session.instances) {
    return Session.instances[sid];
  }

  var settings = {};
  // platforms used by this 
  var platforms = {};

  var instance = {

    // Configure the session, usually due to a REGISTER command.
    //
    // "settings" look like this:
    //   {
    //     storageInfo: {
    //       type: '...',
    //       href: '...',
    //     },
    //     bearerToken: '...',
    //     scope: {
    //       '...' : 'rw'
    //     }
    //   }
    //
    configure: function(_settings) {
      settings = _settings;
    },

    // Reset the session.
    reset: function() {
      settings = {};
      platforms = {};
    },

    // Get a file from remoteStorage.
    //
    // Example:
    //   // will GET {storageRoot}/messages/.xmpp and (if applicable)
    //   // parse it's content as JSON.
    //   session.get('messages', '.xmpp')
    //
    // Returns:
    //   Either the parsed JSON object (if Content-Type: application/json), or
    //   an object of the form { mimeType: '...', data: '...' }.
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

    // Add a platform to the list of platforms used by this session
    // so far. The list is required to keep track of what platforms
    // need to receive the "cleanup" command once the session is ended.
    addPlatform: function(platform) {
      platforms[platform] = true;
    },

    // Get a list of all platforms used by this session so far.
    getPlatforms: function() {
      return Object.keys(platforms);
    }
    
  };

  Session.instances[sid] = instance;

  console.log('[session] Created #' + sid + '.');

  return instance;

};

module.exports = Session;
