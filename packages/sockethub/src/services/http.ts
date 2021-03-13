import debug from 'debug';
import bodyParser from 'body-parser';
import express from 'express';
import * as HTTP from 'http';
import SocketIO from 'socket.io';

import config from '../config';
import routeBase from '../routes/base';
import routeExamples from '../routes/examples';

const log = debug('sockethub:services:http');

const http = {
  start: function () {
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

    this.__startListener(http);
    return io;
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

export default http;
