const nconf      = require('nconf'),
      randToken  = require('rand-token');

const routes      = [],
      debug_scope = process.env.DEBUG || '',
      address     = nconf.get('public:protocol') + '://' +
                      nconf.get('public:host') + ':' +
                      nconf.get('public:port') +
                      nconf.get('public:path');

if (nconf.get('examples:enabled')) {
  // only add routes if --dev flag is present
  routes.push({
    meta: {
      method: 'GET',
      path: '/examples/dummy'
    },
    route: (req, res) => {
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
    route: (req, res) => {
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
    route: (req, res) => {
      res.render('examples/irc.ejs', {
        debug_scope: debug_scope,
        address: address,
        randToken: randToken.generate(5)
      });
    }
  },

  {
    meta: {
      method: 'GET',
      path: '/examples/xmpp'
    },
    route: (req, res) => {
      res.render('examples/xmpp.ejs', {
        debug_scope: debug_scope,
        address: address,
        randToken: randToken.generate(5)
      });
    }
  });
}

/**
 * Setup
 */

exports.setup = (app) => {
  routes.forEach((route) => {
    app[route.meta.method.toLowerCase()](
      route.meta.path,
      route.route
    );
  });
};
