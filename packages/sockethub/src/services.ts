import debug from 'debug';
import bodyParser from 'body-parser';
import express from 'express';
import * as HTTP from 'http';
import kue from 'kue';
import SocketIO from 'socket.io';

import config from './config';
import routeBase from './routes/base';
import routeExamples from './routes/examples';

const log = debug('sockethub:services');

let redisCfg = config.get('redis');
if (redisCfg.url) {
  redisCfg = redisCfg.url;
}
log('redis connection info ', redisCfg);

const services = {
  startQueue: function (parentId: string) {
    const channel = `sockethub:${parentId}`;
    log(`queue started on channel ${channel}`);
    return kue.createQueue({
      prefix: channel,
      redis: redisCfg
    });
  },

  startExternal: function () {
    const app = this.__initExpress();
    // initialize express and socket.io objects
    const http = new HTTP.Server(app);
    const io = SocketIO(http, {path: config.get('service:path')});

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
    http.listen(config.get('service:port'), config.get('service:host'), () => {
      log(`sockethub listening on ` +
        `http://${config.get('service:host')}:${config.get('service:port')}`);
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
