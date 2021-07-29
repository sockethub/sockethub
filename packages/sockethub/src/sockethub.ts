import debug from 'debug';
import ActivityStreams from 'activity-streams';
import { Socket } from "socket.io";

import config from './config';
import crypto from './crypto';
import init from './bootstrap/init';
import Middleware from './middleware';
import janitor from './janitor';
import serve from './serve';
import validate from './validate';
import ProcessManager from "./process-manager";
import { platformInstances } from "./platform-instance";
import {getSessionStore, ISecureStoreInstance} from "./store";

const log = debug('sockethub:core'),
      activity = ActivityStreams(config.get('activity-streams:opts'));


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


function getMiddleware(socket: Socket, sessionLog: Function) {
  return new Middleware((err, type: string, msg: ActivityObject) => {
    sessionLog('validation failed for ' + type + '. ' + err, msg);
    // called with validation fails
    if (typeof msg !== 'object') {
      msg = { context: 'error' };
    }
    msg.error = err;
    // send failure
    socket.emit('failure', msg);
  });
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
    return (msg) => {
      const platformInstance = this.processManager.get(msg.context, msg.actor['@id'], socket.id);
      const title = `${msg.context}-${(msg['@id']) ? msg['@id'] : this.counter++}`;
      sessionLog(`queued to channel ${platformInstance.id}`);
      const job: JobDataEncrypted = {
        title: title,
        sessionId: socket.id,
        msg: crypto.encrypt(msg, this.parentSecret1 + this.parentSecret2)
      };
      platformInstance.queue.add(job);
    };
  };

  private handleStoreCredentials(store: ISecureStoreInstance, sessionLog: Function) {
    return (creds: ActivityObject) => {
      store.save(creds.actor['@id'], creds, (err) => {
        if (err) {
          sessionLog('error saving credentials to store ' + err);
        } else {
          sessionLog('credentials encrypted and saved');
        }
      });
    };
  };

  private incomingConnection(socket: Socket) {
    const sessionLog = debug('sockethub:core:' + socket.id), // session-specific debug messages
          sessionSecret = crypto.randToken(16),
          // store instance is session-specific
          store = getSessionStore(this.parentId, this.parentSecret1, socket.id, sessionSecret),
          middleware = getMiddleware(socket, sessionLog);

    sessionLog(`socket.io connection`);

    socket.on('disconnect', () => {
      sessionLog('disconnect received from client.');
    });

    socket.on(
      'credentials',
      middleware.chain(
        validate('credentials', socket.id), this.handleStoreCredentials(store, sessionLog))
    );

    socket.on(
      'message',
      middleware.chain(
        validate('message', socket.id),
        (next, msg) => {
          // middleware which attaches the sessionSecret to the message. The platform thread
          // must find the credentials on their own using the given sessionSecret, which indicates
          // that this specific session (socket connection) has provided credentials.
          msg.sessionSecret = sessionSecret;
          next(true, msg);
        },
        this.handleIncomingMessage(socket, sessionLog)
      )
    );

    // when new activity objects are created on the client side, an event is
    // fired and we receive a copy on the server side.
    socket.on(
      'activity-object',
      middleware.chain(
        validate('activity-object', socket.id),
        activity.Object.create
      )
    );
  }
}

export default Sockethub;