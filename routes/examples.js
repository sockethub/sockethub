var nconf  = require('nconf');

var routes      = [],
    debug_scope = process.env.DEBUG || '',
    address     = nconf.get('public:protocol') + '://' +
                    nconf.get('public:host') + ':' +
                    nconf.get('public:port') +
                    nconf.get('public:path');

routes.push({
  meta: {
    method: 'GET',
    path: '/examples/dummy'
  },
  route: function (req, res) {
    res.render('examples/dummy.ejs', {
      debug_scope: debug_scope,
      address: address
    });
  }
},

{
  meta: {
    method: 'GET',
    path: '/examples/feeds'
  },
  route: function (req, res) {
    res.render('examples/feeds.ejs', {
      debug_scope: debug_scope,
      address: address
    });
  }
},

{
  meta: {
    method: 'GET',
    path: '/examples/irc'
  },
  route: function (req, res) {
    res.render('examples/irc.ejs', {
      debug_scope: debug_scope,
      address: address
    });
  }
});


/**
 * Setup
 */

exports.setup = function (app) {
  routes.forEach(function (route) {
    app[route.meta.method.toLowerCase()](
      route.meta.path,
      route.route
    );
  });
};
