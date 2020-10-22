import { ChildProcess, fork } from 'child_process';
import { join } from 'path';

import SharedResources from "./shared-resources";

interface ActivityStream {
  '@type': string,
  actor: {
    '@type': string,
    '@id': string
  },
  object: {
    '@type': string
  }
}

interface MessageFromPlatform extends Array<string|ActivityStream>{0: string, 1: ActivityStream}
export interface MessageFromParent extends Array<string|any>{0: string, 1: any}


class PlatformInstance {
  flaggedForTermination: boolean = false;
  readonly id: string;
  readonly name: string;
  readonly process: ChildProcess;
  readonly parentId: string;
  readonly sessions: Set<string> = new Set();
  private readonly actor?: string;
  public readonly global?: boolean;
  private readonly listeners: object = {
    'close': (() => new Map())(),
    'message': (() => new Map())(),
  };

  constructor(id: string, name: string, parentId: string, actor?: string) {
    this.id = id;
    this.name = name;
    this.parentId = parentId;
    if (actor) {
      this.actor = actor;
    } else {
      this.global = true;
    }
    // spin off a process
    this.process = fork(join(__dirname, 'platform.js'), [parentId, name, id]);
  }

  public registerSession(sessionId: string) {
    if (! this.sessions.has(sessionId)) {
      this.sessions.add(sessionId);
      this.registerListeners(sessionId);
    }
  }

  public deregisterSession(sessionId: string) {
    SharedResources.helpers.removePlatform(this);
    this.sessions.delete(sessionId);
    this.deregisterListeners(sessionId);
  }

  public sendToClient(sessionId: string, msg: any) {
    const socket = SharedResources.sessionConnections.get(sessionId);
    if (socket) { // send message
      msg.context = this.name;
      // console.log(`sending message to socket ${sessionId}`);
      socket.emit('message', msg);
    }
  }

  private deregisterListeners(sessionId: string) {
    for (let key of Object.keys(this.listeners)) {
      this.process.removeListener(key, this.listeners[key].get(sessionId));
      this.listeners[key].delete(sessionId);
    }
  }

  private registerListeners(sessionId: string) {
    for (let key of Object.keys(this.listeners)) {
      const listenerFunc = this.listenerFunction(key, sessionId);
      this.process.on(key, listenerFunc);
      this.listeners[key].set(sessionId, listenerFunc);
    }
  }

  /**
   * Sends error message to client and clears all references to this class.
   * @param sessionId
   * @param errorMessage
   */
  private reportFailure(sessionId: string, errorMessage: any) {
    const errorObject = {
      context: this.name,
      '@type': 'error',
      target: this.actor || {},
      object: {
        '@type': 'error',
        content: errorMessage
      }
    };
    this.sendToClient(sessionId, errorObject);
    this.sessions.clear();
    this.flaggedForTermination = true;
    SharedResources.helpers.removePlatform(this);
  }

  private listenerFunction(key: string, sessionId: string) {
    const funcs = {
      'close': (e: object) => {
        console.log('close even triggered ' + this.id);
        this.reportFailure(sessionId, `Error: session thread closed unexpectedly`);
      },
      'message': (data: MessageFromPlatform) => {
        if (data[0] === 'updateCredentials') {
          // TODO FIXME - handle the case where a user changes their credentials
          //  (username or password). We need to update the store.
        } else if (data[0] === 'error') {
          this.reportFailure(sessionId, data[1]);
        } else {
          // treat like a message to clients
          // console.log("handling normal message event from platform ", data[1]);
          this.sendToClient(sessionId, data[1]);
        }
      }
    };
    return funcs[key];
  }
}

export default PlatformInstance;
