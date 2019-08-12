import path from 'path';

import config from './../config';
let routes = [];

routes.push({
  meta: {
    method: 'GET',
    path: '/sockethub-client.js'
  },
  route: (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(path.resolve(__dirname + '/../../src/js/client.js'));
  }
}, {
  meta: {
    method: 'GET',
    path: '/socket.io.js'
  },
  route: (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(
      path.resolve(`${__dirname}/../../node_modules/socket.io-client/dist/socket.io.js`));
  }
}, {
  meta: {
    method: 'GET',
    path: '/activity-streams.js'
  },
  route: (req, res) => {
    res.sendFile(
      path.resolve(__dirname
      + '/../../node_modules/activity-streams/browser/activity-streams.js'));
  }
}, {
  meta: {
    method: 'GET',
    path: '/activity-streams.min.js'
  },
  route: (req, res) => {
    res.sendFile(
      path.resolve(__dirname
      + '/../../node_modules/activity-streams/browser/activity-streams.min.js'));
  }
});

if (config.get('examples:enabled')) {
  routes.push({
    meta: {
      method: 'GET',
      path: '/'
    },
    route: (req, res) => {
      res.render('index.ejs');
    }
  }, {
    meta: {
      method: 'GET',
      path: '/jquery.js'
    },
    route: (req, res) => {
      res.sendFile(path.resolve(__dirname + '/../../node_modules/jquery/dist/jquery.min.js'));
    }
  }, {
    meta: {
      method: 'GET',
      path: '/examples/shared.js'
    },
    route: (req, res) => {
      res.sendFile(path.resolve(__dirname + '/../examples/examples/shared.js'));
    }
  }, {
    meta: {
      method: 'GET',
      path: '/jquery.min.map'
    },
    route: (req, res) => {
      res.sendFile(path.resolve(__dirname + '/../../node_modules/jquery/dist/jquery.min.map'));
    }
  });
}

/**
 * Setup
 */
const routeBase = {
  setup: function (app) {
    routes.forEach((route) => {
      app[route.meta.method.toLowerCase()](
        route.meta.path,
        route.route
      );
    });
  }
};
export default routeBase;
