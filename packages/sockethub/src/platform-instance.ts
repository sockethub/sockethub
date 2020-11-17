import { ChildProcess, fork } from 'child_process';
import { join } from 'path';
import { debug, Debugger } from 'debug';

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


export default class PlatformInstance {
  flaggedForTermination: boolean = false;
  readonly id: string;
  readonly name: string;
  readonly process: ChildProcess;
  readonly debug: Debugger;
  readonly parentId: string;
  readonly sessions: Set<string> = new Set();
  private readonly actor?: string;
  public readonly global?: boolean = false;
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
    this.debug = debug(`sockethub:platform-instance:${this.id}`);
    // spin off a process
    this.process = fork(join(__dirname, 'platform.js'), [ parentId, name, id ]);
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

  /**
   * Sends a message to client (user), can be registered with an event emitted from the platform
   * process.
   * @param sessionId ID of the socket connection to send the message to
   * @param msg ActivityStream object to send to client
   */
  public sendToClient(sessionId: string, msg: any) {
    const socket = SharedResources.sessionConnections.get(sessionId);
    if (socket) { // send message
      msg.context = this.name;
      // this.log(`sending message to socket ${sessionId}`);
      socket.emit('message', msg);
    }
  }

  /**
   * Remove listener and delete it from the map.
   * @param sessionId ID of the socket connection that will no longer receive messages from
   * platform emits.
   */
  private deregisterListeners(sessionId: string) {
    for (let type of Object.keys(this.listeners)) {
      this.process.removeListener(type, this.listeners[type].get(sessionId));
      this.listeners[type].delete(sessionId);
    }
  }

  /**
   * Register listener to be called when the process emits a message.
   * @param sessionId ID of socket connection that will receive messages from platform emits
   */
  private registerListeners(sessionId: string) {
    for (let type of Object.keys(this.listeners)) {
      const listenerFunc = this.listenerFunction(type, sessionId);
      this.process.on(type, listenerFunc);
      this.listeners[type].set(sessionId, listenerFunc);
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

  /**
   * Generates a function tied to a given client session (socket connection), the generated
   * function will be called for each session ID registered, for every platform emit.
   * @param listener
   * @param sessionId
   */
  private listenerFunction(listener: string, sessionId: string) {
    const funcs = {
      'close': (e: object) => {
        this.debug('close even triggered ' + this.id);
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
          this.debug("handling message from platform process", data[1]);
          this.sendToClient(sessionId, data[1]);
        }
      }
    };
    return funcs[listener];
  }
}