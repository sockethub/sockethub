import init from './bootstrap/init';
import SharedResources from "./shared-resources";
import crypto from "./crypto";
import { fork } from "child_process";

class ProcessManager {
  private readonly parentId: string;
  private readonly parentSecret1: string;
  private readonly parentSecret2: string;

  constructor(parentId: string, parentSecret1: string, parentSecret2: string) {
    this.parentId = parentId;
    this.parentSecret1 = parentSecret1;
    this.parentSecret2 = parentSecret2;
  }

  register(msg: any) {
    const platformDetails = init.platforms.get(msg.context);

    if (! platformDetails.config.persist) {
      // ensure process is started
      return this.ensureProcess(msg.context);
    } else {
      return this.ensureProcess(msg.context, msg.actor['@id']);
    }
  }
  
  ensureProcess(platform: string, actor?: string) {
    const identifier = actor ? crypto.hash(platform + actor) : crypto.hash(platform);

    if (SharedResources.platformInstances.has(identifier)) {
      return identifier;
    }

    // spin off a process
    const childProcess = fork('dist/platform.js', [this.parentId, platform, identifier]);

    const platformInstance = {
      id: identifier,
      name: platform,
      actor: actor,
      config: { persist: true },
      sendToClient: (e) => {
        console.log('sendToClient called ', e);
      },
      process: childProcess,
      credentialsHash: undefined,
      flaggedForTermination: false,
      sockets: new Set()
    };

    childProcess.on('close', (e) => {
      console.log('close even triggered');
      platformInstance.sendToClient({
        context: platformInstance.name,
        '@type': 'error',
        target: platformInstance.actor,
        object: {
          '@type': 'error',
          content: e
        }
      });
      console.log('remove platform instance ' + platformInstance.id);
      SharedResources.helpers.removePlatform(platformInstance);
    });

    childProcess.send({
      type: 'secrets',
      data: {
        parentSecret1: this.parentSecret1,
        parentSecret2: this.parentSecret2,
      }
    });
    
    SharedResources.platformInstances.set(identifier, platformInstance);
    return identifier;
  }
}

export default ProcessManager;