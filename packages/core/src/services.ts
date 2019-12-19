import debug from 'debug';
import bodyParser from 'body-parser';
import express from 'express';
import * as HTTP from 'http';
import kue from 'kue';
import SocketIO from 'socket.io';

import init from './bootstrap/init';
import routeBase from './routes/base';
import routeExamples from './routes/examples';
import config from './config';

const log = debug('sockethub:services');

let redisCfg = config.get('redis');
if (redisCfg.url) {
  redisCfg = redisCfg.url;
}
log('redis connection info ', redisCfg);

const services = {
  startQueue: function (parentId) {
    return kue.createQueue({
      prefix: 'sockethub:services:queue:' + parentId,
      redis: redisCfg
    });
  },

  startExternal: function () {
    const app = this.__initExpress();
    // initialize express and socket.io objects
    const http = new HTTP.Server(app);
    const io = SocketIO(http, {path: init.path});

    // routes list
    [
      routeBase,
      routeExamples
    ].map((route) => {
      return route.setup(app);
    });

    this.__startKue();
    this.__startListener(http);
    return io;
  },

  __startKue: function () {
    if (config.get('kue:enabled')) {
      // start kue UI
      kue.app.listen(config.get('kue:port'), config.get('kue:host'), () => {
        log('service queue interface listening on ' + config.get('kue:host') + ':'
          + config.get('kue:port'));
      });
    }
  },

  __startListener: function (http) {
    http.listen(init.port, init.host, () => {
      log('sockethub listening on http://' + init.host + ':' + init.port);
      log('active platforms: ', [...init.platforms.keys()]);
    });
  },

  __initExpress: function () {
    let app = express();
    // templating engines
    app.set('view engine', 'ejs');

    // use bodyParser
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(bodyParser.json());
    return app;
  }
};

export default services;
