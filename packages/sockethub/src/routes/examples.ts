import path from 'path';
import * as randToken from 'rand-token';

import config from './../config';

const routes      = [],
      debug_scope = process.env.DEBUG || '',
      address     = config.get('public:protocol') + '://' +
                    config.get('public:host') + ':' +
                    config.get('public:port') +
                    config.get('public:path');

if (config.get('examples:enabled')) {
  // only add routes if --dev flag is present
  routes.push({
    meta: {
      method: 'GET',
      path: '/examples/dummy'
    },
    route: (req, res) => {
      res.render(path.resolve(__dirname + './../../views/examples/dummy.ejs'), {
        debug_scope: debug_scope,
        address: address
      });
    }
  }, {
    meta: {
      method: 'GET',
      path: '/examples/feeds'
    },
    route: (req, res) => {
      res.render(path.resolve(__dirname + './../../views/examples/feeds.ejs'), {
        debug_scope: debug_scope,
        address: address
      });
    }
  }, {
    meta: {
      method: 'GET',
      path: '/examples/irc'
    },
    route: (req, res) => {
      res.render(path.resolve(__dirname + './../../views/examples/irc.ejs'), {
        debug_scope: debug_scope,
        address: address,
        randToken: randToken.generate(5)
      });
    }
  }, {
    meta: {
      method: 'GET',
      path: '/examples/xmpp'
    },
    route: (req, res) => {
      res.render(path.resolve(__dirname + './../../views/examples/xmpp.ejs'), {
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
const routeExamples = {
  setup: function (app) {
    routes.forEach((route) => {
      app[route.meta.method.toLowerCase()](
        route.meta.path,
        route.route
      );
    });
  }
};
export default routeExamples;
