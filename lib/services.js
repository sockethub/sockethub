/* global __dirname */
const bodyParser = require('body-parser'),
      Debug      = require('debug'),
      express    = require('express'),
      HTTP       = require('http'),
      kue        = require('kue'),
      nconf      = require('nconf'),
      path       = require('path'),
      SocketIO   = require('socket.io');

const init       = require('./bootstrap/init.js');

const debug = Debug('sockethub:services');


function Services() {}

Services.prototype.startInternal = function (parentId) {
  let redisCfg = nconf.get('redis');
  if (redisCfg.url) {
    redisCfg = redisCfg.url;
  }
  debug('redis connection info ', redisCfg);

  const queue = kue.createQueue({
    prefix: 'sockethub:service:kue:' + parentId,
    redis: redisCfg
  });

  return queue;
};

Services.prototype.startExternal = function () {
  const app = this.__initExpress();
  // initialize express and socket.io objects
  const http  = HTTP.Server(app);
  const io    = SocketIO(http, { path: init.path });

  // routes list
  [
    'base',
    'examples'
  ].map((routeName) => {
    const route = require( path.join(__dirname, '/../', 'routes', routeName) );
    return route.setup(app);
  });

  this.__startKue();
  this.__startListener(http);
  return io;
};

Services.prototype.__startKue = function () {
  if (nconf.get('kue:enabled')) {
    // start kue UI
    kue.app.listen(nconf.get('kue:port'), nconf.get('kue:host'), () => {
      debug('service queue interface listening on ' + nconf.get('kue:host') + ':'
        + nconf.get('kue:port'));
    });
  }
};

Services.prototype.__startListener = function (http) {
  http.listen(init.port, init.host, () => {
    debug('sockethub listening on http://' + init.host + ':' + init.port);
    debug('active platforms: ', [...init.platforms.keys()]);
  });
};

Services.prototype.__initExpress = function () {
  let app   = express();
  // templating engines
  app.set('view engine', 'ejs');

  // use bodyParser
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());
  return app;
}

module.exports = Services;