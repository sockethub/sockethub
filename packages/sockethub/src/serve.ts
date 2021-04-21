import debug from 'debug';
import bodyParser from 'body-parser';
import express from 'express';
import * as HTTP from 'http';
import { Server } from 'socket.io';

import config from './config';
import routeBase from './routes/base';
import routeExamples from './routes/examples';

const log = debug('sockethub:services:http');

/**
 * Handles the initialization and access of service objects.
 *
 * @example
 *
 * serve.start() // starts http, express, socket.io
 * serve.io // socket.io object
 * serve.http // http object
 */
class Serve {
  io: Server;
  http: HTTP.Server;

  start() {
    // initialize express and socket.io objects
    const app = Serve.initExpress();
    this.http = new HTTP.Server(app);
    this.io = new Server(this.http, {path: config.get('service:path')});

    // routes list
    [
      routeBase,
      routeExamples
    ].map((route) => {
      return route.setup(app);
    });

    this.startListener();
  }

  private startListener() {
    this.http.listen(config.get('service:port'), config.get('service:host'), () => {
      log(`sockethub listening on ` +
        `http://${config.get('service:host')}:${config.get('service:port')}`);
    });
  };

  private static initExpress() {
    let app = express();
    // templating engines
    app.set('view engine', 'ejs');
    // use bodyParser
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(bodyParser.json());
    return app;
  }
}

const serve = new Serve();
export default serve;
