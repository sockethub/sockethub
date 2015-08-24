if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define([], function() {
var suites = [];

suites.push({
  name: "remoteStorage provider tests",
  desc: "integration tests to ensure a provider is remoteStorage 2011.04 compliant",
  setup: function(env) {
    env.hostname = "https://heahdk.net";
    env.username = "silverbucket@heahdk.net";
    env.uri = {
      webfinger: "/.well-known/host-meta?resource=acct:"+env.username
    };

    env.verify = {
      type: 'https://www.w3.org/community/rww/wiki/read-write-web-00#simple',
      'auth-method': 'https://tools.ietf.org/html/draft-ietf-oauth-v2-26#section-4.2'
    };

    env.http = new this.Http({
      baseUrl: env.hostname
    });
    this.result(true);
  },
  tests: [
    {
      desc: "webfinger & CORS",
      run: function(env) {
        var _this = this;
        env.http.get(env.uri.webfinger, {
          success: function(data, status, xhr) {
            var cors = xhr.getResponseHeader('access-control-allow-origin');
            _this.assertAnd(cors, '*');
            _this.assertTypeAnd(data, 'object');
            _this.assertTypeAnd(data.links, 'array');
            _this.assertTypeAnd(data.links[0], 'object');
            _this.assertAnd(data.links[0].rel, 'remoteStorage');
            _this.assertAnd(data.links[0].type, env.verify.type);
            _this.assertTypeAnd(data.links[0].properties, 'object');
            _this.assertAnd(data.links[0].properties['auth-method'], env.verify['auth-method']);
            _this.assertTypeAnd(data.links[0].properties['auth-endpoint'], 'string');
            env['auth-endpoint'] = data.links[0].properties['auth-endpoint'];
            _this.result(true);

          },
          error: function() {
            _this.result(false, 'failed get on URI: '+env.uri.webfinger);
          }
        });
      }
    }
  ]
});
return suites;
});
