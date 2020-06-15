import { ChildProcess, fork } from 'child_process';

import SharedResources from "./shared-resources";

class PlatformInstance {
  flaggedForTermination: boolean = false;
  readonly id: string;
  readonly name: string;
  readonly process: ChildProcess;
  readonly parentId: string;
  readonly sessions: Set<string> = new Set();
  private readonly actor?: string;
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
    }
    // spin off a process
    this.process = fork('dist/platform.js', [parentId, name, id]);
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
      // this.log(`sending message to socket ${sessionId}`);
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

  private generateASErrorObject(sessionId: string) {
    return {
      context: this.name,
      '@type': 'error',
      target: this.actor || {},
      object: {
        '@type': 'error',
        content: undefined
      }
    }
  }

  private listenerFunction(key, sessionId) {
    const funcs = {
      'close': (e) => {
        console.log('close even triggered ' + this.id);
        let errorAS = this.generateASErrorObject(sessionId);
        errorAS.object.content = 'irc session closed unexpectedly.';
        this.sendToClient(sessionId, errorAS);
        this.deregisterSession(sessionId);
      },
      'message': (data) => {
        if (data[0] === 'updateCredentials') {
          // TODO FIXME - handle the case where a user changes their credentials
          //  (username or password). We need to update the store.
        } else if (data[0] === 'error') {
          let errorAS = this.generateASErrorObject(sessionId);
          errorAS.object.content = data[1];
          this.sendToClient(sessionId, errorAS);
        }
      }
    };
    return funcs[key];
  }
}

export default PlatformInstance;
