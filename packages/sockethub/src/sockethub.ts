import debug from 'debug';
import randToken from 'rand-token';
import ActivityStreams from 'activity-streams';
import { Socket } from "socket.io";

import config from './config';
import crypto from './crypto';
import init from './bootstrap/init';
import Middleware from './middleware';
import resourceManager from './resource-manager';
import http from './services/http';
import validate from './validate';
import SharedResources from "./shared-resources";
import ProcessManager from "./process-manager";
import { getSessionStore, Store } from "./common";

const log = debug('sockethub:core  '),
      activity = ActivityStreams(config.get('activity-streams:opts'));


export interface JobData {
  title?: string;
  msg: ActivityObject;
  sessionId: string;
}

export interface Job {
  data: JobData,
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
  io: any;
  processManager: ProcessManager;

  constructor() {
    this.counter = 0;
    this.platforms = init.platforms;
    this.status = false;
    this.parentId = randToken.generate(16);
    this.parentSecret1 = randToken.generate(16);
    this.parentSecret2 = randToken.generate(16);
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
    resourceManager.start();

    // start external services
    this.io = http.start();
    log('registering handlers');
    this.io.on('connection', this.incomingConnection.bind(this));
  }

  removeAllPlatformInstances() {
    for (let platform of SharedResources.platformInstances.values()) {
      platform.destroy();
    }
  }

  private handleIncomingMessage(socket: Socket, sessionLog: Function) {
    return (msg) => {
      const platformInstance = this.processManager.get(msg.context, msg.actor['@id'], socket.id);
      sessionLog(`queueing incoming job ${msg.context} to channel ${platformInstance.id}`);
      const job: JobData = {
        title: `${socket.id}-${msg.context}-${(msg['@id']) ? msg['@id'] : this.counter++}`,
        sessionId: socket.id,
        msg: crypto.encrypt(msg, this.parentSecret1 + this.parentSecret2)
      };
      platformInstance.queue.add(job);
    };
  };

  private handleStoreCredentials(store: Store, sessionLog: Function) {
    return (creds: ActivityObject) => {
      store.save(creds.actor['@id'], creds, (err) => {
        if (err) {
          sessionLog('error saving credentials to store ' + err);
        } else {
          sessionLog('credentials encrypted and saved with key: ' + creds.actor['@id']);
        }
      });
    };
  };

  private incomingConnection(socket: Socket) {
    const sessionLog = debug('sockethub:core  :' + socket.id), // session-specific debug messages
          sessionSecret = randToken.generate(16),
          // store instance is session-specific
          store = getSessionStore(this.parentId, this.parentSecret1, socket.id, sessionSecret),
          middleware = getMiddleware(socket, sessionLog);

    sessionLog(`connection on socket.io channel ${socket.id}`);

    SharedResources.sessionConnections.set(socket.id, socket);

    socket.on('disconnect', () => {
      sessionLog('disconnect received from client.');
      SharedResources.sessionConnections.delete(socket.id);
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