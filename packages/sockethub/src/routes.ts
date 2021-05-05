import path from 'path';
import * as randToken from 'rand-token';
import config from "./config";
import crypto from "./crypto";

const debug_scope = process.env.DEBUG || '',
      address     = config.get('public:protocol') + '://' +
                    config.get('public:host') + ':' +
                    config.get('public:port') +
                    config.get('public:path');

export const basePaths = {
  '/sockethub-client.js': path.resolve(`${__dirname}/js/client.js`),
  '/socket.io.js': path.resolve(`${__dirname}/../node_modules/socket.io/client-dist/socket.io.js`),
  '/socket.io.js.map': path.resolve(
    `${__dirname}/../node_modules/socket.io/client-dist/socket.io.js.map`),
  // '/activity-streams.js':
  // path.resolve(`${__dirname}/../node_modules/activity-streams/browser/activity-streams.js`),
  '/activity-streams.min.js':
    path.resolve(`${__dirname}/../node_modules/activity-streams/browser/activity-streams.min.js`),
};

export const examplePaths = {
  '/': path.resolve(`${__dirname}/../views/index.ejs`),
  '/jquery.js': path.resolve(`${__dirname}/../node_modules/jquery/dist/jquery.min.js`),
  '/jquery.min.map': path.resolve(`${__dirname}/../node_modules/jquery/dist/jquery.min.map`),
  '/examples/shared.js': path.resolve(`${__dirname}/../views/examples/shared.js`)
};

export const examplePages = {
  '/examples/dummy': path.resolve(`${__dirname}/../views/examples/dummy.ejs`),
  '/examples/feeds': path.resolve(`${__dirname}/../views/examples/feeds.ejs`),
  '/examples/irc': path.resolve(`${__dirname}/../views/examples/irc.ejs`),
  '/examples/xmpp': path.resolve(`${__dirname}/../views/examples/xmpp.ejs`)
};

let baseRoutes = [];
let exampleRoutes = [];

Object.keys(basePaths).forEach((key) => {
  baseRoutes.push({
    meta: {
      method: 'GET',
      path: key
    },
    route: (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.sendFile(basePaths[req.url]);
    }
  });
});


Object.keys(examplePaths).forEach((key) => {
  exampleRoutes.push({
    meta: {
      method: 'GET',
      path: key
    },
    route: (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.sendFile(examplePaths[req.url]);
    }
  });
});

Object.keys(examplePages).forEach((key) => {
  exampleRoutes.push({
    meta: {
      method: 'GET',
      path: key
    },
    route: (req, res) => {
      res.render(examplePages[req.url], {
        debug_scope: debug_scope,
        address: address,
      });
    }
  });
});

function addRoute(app) {
  return (route) => {
    app[route.meta.method.toLowerCase()](
      route.meta.path,
      route.route
    );
  };
}
/**
 * Setup
 */
const routes = {
  setup: function (app: any, examplesEnabled: boolean = config.get('examples:enabled')) {
    baseRoutes.forEach(addRoute(app));
    if (examplesEnabled) {
      exampleRoutes.forEach(addRoute(app));
    }
  }
};
export default routes;
