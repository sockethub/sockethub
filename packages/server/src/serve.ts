import debug from 'debug';
import bodyParser from 'body-parser';
import express from 'express';
import * as HTTP from 'http';
import { Server } from 'socket.io';

import config from './config';
import routes from './routes';

const log = debug('sockethub:server:http');

/**
 * Handles the initialization and access of Sockethub resources.
 *
 *  - HTTP Server
 *  - Express (serves resources and example routes)
 *  - Socket.io (bidirectional websocket communication)
 */
class Serve {
  io: Server;
  http: HTTP.Server;

  /**
   * Starts the services needed for Sockethub to operate. After this command completes,
   * the `http` and `io` class properties will be set.
   */
  start() {
    // initialize express and socket.io objects
    const app = Serve.initExpress();
    this.http = new HTTP.Server(app);
    this.io = new Server(this.http, {
      path: config.get('sockethub:path'),
      cors: {
        origin: "*",
        methods: [ "GET", "POST" ]
      }
    });
    routes.setup(app);
    this.startListener();
  }

  private startListener() {
    this.http.listen(config.get('sockethub:port'), config.get('sockethub:host'), () => {
      log(`sockethub listening on ` +
        `http://${config.get('sockethub:host')}:${config.get('sockethub:port')}`);
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

export interface SocketInstance {
  id: string;
  emit: Function;
}

export async function getSocket(sessionId: string): Promise<SocketInstance> {
  const sockets: Array<SocketInstance> = await serve.io.fetchSockets();
  return new Promise((resolve, reject) => {
    for (let socket of sockets) {
      if (sessionId === socket.id) {
        return resolve(socket);
      }
    }
    return reject(`unable to find socket for sessionId ${sessionId}`);
  });
}

export default serve;
