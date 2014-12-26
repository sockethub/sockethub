var nconf  = require('nconf');
var routes = [];

routes.push({
  meta: {
    method: 'GET',
    path: '/examples/irc'
  },
  route: function (req, res) {
    res.render('examples/irc.ejs', {
      debug_scope: process.env.DEBUG || '',
      address: nconf.get('public:protocol') + '://' +
               nconf.get('public:host') + ':' +
               nconf.get('public:port') +
               nconf.get('public:path')
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
