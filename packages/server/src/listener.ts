import debug from 'debug';
import bodyParser from 'body-parser';
import express from 'express';
import * as HTTP from 'http';
import { Server } from 'socket.io';

import config from './config';
import routes from './routes';

const log = debug('sockethub:server:listener');

/**
 * Handles the initialization and access of Sockethub resources.
 *
 *  - HTTP Server
 *  - Express (serves resources and example routes)
 *  - Socket.io (bidirectional websocket communication)
 */
class Listener {
  io: Server;
  http: HTTP.Server;

  /**
   * Starts the services needed for Sockethub to operate. After this command completes,
   * the `http` and `io` class properties will be set.
   */
  start() {
    // initialize express and socket.io objects
    const app = Listener.initExpress();
    this.http = new HTTP.Server(app);
    this.io = new Server(this.http, {
      path: config.get('sockethub:path') as string,
      cors: {
        origin: "*",
        methods: [ "GET", "POST" ]
      }
    });
    routes.setup(app);
    this.startHttp();
  }

  private startHttp() {
    this.http.listen(config.get('sockethub:port'), config.get('sockethub:host') as number, () => {
      log(`sockethub listening on ` +
        `${config.get('sockethub:host')}:${config.get('sockethub:port')}`);
    });
  }

  private static initExpress() {
    const app = express();
    // templating engines
    app.set('view engine', 'ejs');
    // use bodyParser
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(bodyParser.json());
    return app;
  }
}

const listener = new Listener();

interface EmitFunction {
  (type: string, data: unknown)
}

export interface SocketInstance {
  id: string;
  emit: EmitFunction;
}

export async function getSocket(sessionId: string): Promise<SocketInstance> {
  const sockets: Array<SocketInstance> = await listener.io.fetchSockets();
  return new Promise((resolve, reject) => {
    for (const socket of sockets) {
      if (sessionId === socket.id) {
        return resolve(socket);
      }
    }
    return reject(`unable to find socket for sessionId ${sessionId}`);
  });
}

export default listener;
