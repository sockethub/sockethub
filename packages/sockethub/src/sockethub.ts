import debug from 'debug';
import { Socket } from "socket.io";

import crypto from './crypto';
import init from './bootstrap/init';
import createMiddleware from './middleware';
import createActivityObject from "./middleware/create-activity-object";
import storeCredentials from "./middleware/store-credentials";
import validate from "./middleware/validate";
import janitor from './janitor';
import serve from './serve';
import ProcessManager from "./process-manager";
import { platformInstances } from "./platform-instance";
import { getSessionStore } from "./store";

const log = debug('sockethub:core');


export interface JobDataDecrypted {
  title?: string;
  msg: ActivityObject;
  sessionId: string;
}

export interface JobDataEncrypted {
  title?: string;
  msg: string;
  sessionId: string;
}

export interface JobDecrypted {
  data: JobDataDecrypted,
  remove?: Function;
}

export interface JobEncrypted {
  data: JobDataEncrypted,
  remove?: Function;
}

export interface ActivityObject {
  '@type'?: string;
  actor?: string | {
    '@type': string;
    '@id'?: string;
  },
  object?: {
    '@type': string;
    content?: any;
  },
  target?: string | {
    '@type': string;
    '@id'?: string;
  },
  context: string;
  error?: any;
  sessionSecret?: string;
}

function errorHandler(type, socket, log) {
  return function reportError(err, msg) {
    log('failure handling ' + type + '. ' + err);
    if (typeof msg !== 'object') {
      msg = { context: 'error' };
    }
    msg.error = err;
    socket.emit('failure', msg);
  };
}

class Sockethub {
  private readonly parentId: string;
  private readonly parentSecret1: string;
  private readonly parentSecret2: string;
  counter: number;
  platforms: Map<string, object>;
  status: boolean;
  queue: any;
  processManager: ProcessManager;

  constructor() {
    this.counter = 0;
    this.platforms = init.platforms;
    this.status = false;
    this.parentId = crypto.randToken(16);
    this.parentSecret1 = crypto.randToken(16);
    this.parentSecret2 = crypto.randToken(16);
    this.processManager = new ProcessManager(
      this.parentId, this.parentSecret1, this.parentSecret2);
    log('sockethub session id: ' + this.parentId);
  }

  /**
   * initialization of sockethub starts here
   */
  boot() {
    if (this.status) {
      return log('Sockethub.boot() called more than once');
    } else {
      this.status = true;
    }

    log('active platforms: ', [...init.platforms.keys()]);
    janitor.clean(); // start cleanup cycle
    serve.start();   // start external services
    log('registering handlers');
    serve.io.on('connection', this.incomingConnection.bind(this));
  }

  removeAllPlatformInstances() {
    for (let platform of platformInstances.values()) {
      platform.destroy();
    }
  }

  private handleIncomingMessage(socket: Socket, sessionLog: Function) {
    return (msg, done: Function) => {
      const platformInstance = this.processManager.get(msg.context, msg.actor['@id'], socket.id);
      const title = `${msg.context}-${(msg['@id']) ? msg['@id'] : this.counter++}`;
      sessionLog(`queued to channel ${platformInstance.id}`);
      const job: JobDataEncrypted = {
        title: title,
        sessionId: socket.id,
        msg: crypto.encrypt(msg, this.parentSecret1 + this.parentSecret2)
      };
      platformInstance.queue.add(job);
      done(job);
    };
  };

  private incomingConnection(socket: Socket) {
    const sessionLog = debug('sockethub:core:' + socket.id), // session-specific debug messages
          sessionSecret = crypto.randToken(16),
          // store instance is session-specific
          store = getSessionStore(this.parentId, this.parentSecret1, socket.id, sessionSecret);

    sessionLog(`socket.io connection`);

    socket.on('disconnect', () => {
      sessionLog('disconnect received from client.');
    });

    socket.on('credentials',
      createMiddleware(errorHandler('credentials', socket, sessionLog))(
        validate('credentials', socket.id),
        storeCredentials(store, sessionLog)
      )
    );

    socket.on(
      'message',
      createMiddleware(errorHandler('message', socket, sessionLog))(
        validate('message', socket.id),
        (msg, done) => {
          // middleware which attaches the sessionSecret to the message. The platform thread
          // must find the credentials on their own using the given sessionSecret, which indicates
          // that this specific session (socket connection) has provided credentials.
          msg.sessionSecret = sessionSecret;
          done(msg);
        },
        this.handleIncomingMessage(socket, sessionLog)
      )
    );

    // when new activity objects are created on the client side, an event is
    // fired and we receive a copy on the server side.
    socket.on(
      'activity-object',
      createMiddleware(errorHandler('message', socket, sessionLog))(
        validate('activity-object', socket.id),
        createActivityObject
      )
    );
  }
}

export default Sockethub;