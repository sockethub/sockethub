import debug from 'debug';
import { Socket } from "socket.io";

import crypto from './crypto';
import init from './bootstrap/init';
import middleware from './middleware';
import createActivityObject from "./middleware/create-activity-object";
import expandActivityStream from "./middleware/expand-activity-stream";
import storeCredentials from "./middleware/store-credentials";
import validate from "./middleware/validate";
import janitor from './janitor';
import serve from './serve';
import ProcessManager from "./process-manager";
import PlatformInstance, { platformInstances } from "./platform-instance";
import { getSessionStore } from "./store";
import { decryptJobData } from './common';

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
  type: string;
  context: string;
  actor: {
    id: string;
    type?: string;
    name?: string;
  },
  object?: {
    type: string;
    content?: any;
  },
  target?: {
    type: string;
    id: string;
    name?: string;
  },
  error?: string;
  sessionSecret?: string;
}

function attachError(err, msg) {
  log('middleware failure ' + err);
  if (typeof msg !== 'object') {
    msg = { context: 'error' };
  }
  msg.error = err.toString();
  return msg;
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
    serve.io.on('connection', this.handleIncomingConnection.bind(this));
  }

  async removeAllPlatformInstances() {
    for (let [key, platform] of platformInstances) {
      await platform.destroy();
    }
  }

  private createJob(socketId: string, platformInstance: PlatformInstance, msg): JobDataEncrypted {
    const title = `${msg.context}-${(msg.id) ? msg.id : this.counter++}`;
    const job: JobDataEncrypted = {
      title: title,
      sessionId: socketId,
      msg: crypto.encrypt(msg, this.parentSecret1 + this.parentSecret2)
    };
    return job;
  };

  private handleIncomingConnection(socket: Socket) {
    const sessionLog = debug('sockethub:core:' + socket.id), // session-specific debug messages
          sessionSecret = crypto.randToken(16),
          // store instance is session-specific
          store = getSessionStore(this.parentId, this.parentSecret1, socket.id, sessionSecret);

    sessionLog(`socket.io connection`);

    socket.on('disconnect', () => {
      sessionLog('disconnect received from client');
    });

    socket.on('credentials',
      middleware('credentials')
        .use(expandActivityStream)
        .use(validate('credentials', socket.id))
        .use(storeCredentials(store, sessionLog))
        .use((err, data, next) => {
          // error handler
          next(attachError(err, data));
        }).use((data, next) => { next(); })
        .done());

    // when new activity objects are created on the client side, an event is
    // fired and we receive a copy on the server side.
    socket.on('activity-object',
      middleware('activity-object')
        .use(validate('activity-object', socket.id))
        .use(createActivityObject)
        .use((err, data, next) => {
          next(attachError(err, data));
        }).use((data, next) => { next(); })
        .done());

    socket.on('message',
      middleware('message')
        .use(expandActivityStream)
        .use(validate('message', socket.id))
        .use((msg, next) => {
          // The platform thread must find the credentials on their own using the given
          // sessionSecret, which indicates that this specific session (socket
          // connection) has provided credentials.
          msg.sessionSecret = sessionSecret;
          next(msg);
        }).use((err, data, next) => {
          next(attachError(err, data));
        }).use((msg, next) => {
          const platformInstance = this.processManager.get(msg.context, msg.actor.id, socket.id);
          sessionLog(`queued to channel ${platformInstance.id}`);
          const job = this.createJob(socket.id, platformInstance, msg);
          // job validated and queued, store socket.io callback for when job is completed
          platformInstance.completedJobHandlers.set(job.title, next);
          platformInstance.queue.add(job);
        }).done());
  }
}

export default Sockethub;