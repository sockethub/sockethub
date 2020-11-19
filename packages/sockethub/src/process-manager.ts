import init from './bootstrap/init';
import SharedResources from "./shared-resources";
import PlatformInstance, { PlatformInstanceParams } from "./platform-instance";
import { getPlatformId } from "./common";
import { MessageFromParent } from "./platform-instance";

class ProcessManager {
  private readonly parentId: string;
  private readonly parentSecret1: string;
  private readonly parentSecret2: string;

  constructor(parentId: string, parentSecret1: string, parentSecret2: string) {
    this.parentId = parentId;
    this.parentSecret1 = parentSecret1;
    this.parentSecret2 = parentSecret2;
  }

  register(msg: any, sessionId?: string) {
    const platformDetails = init.platforms.get(msg.context);

    if (platformDetails.config.persist) {
      // ensure process is started - one for each actor
      return this.ensureProcess(msg.context, sessionId, msg.actor['@id']);
    } else {
      // ensure process is started - one for all jobs
      return this.ensureProcess(msg.context);
    }
  }

  private createPlatformInstance(identifier:string, platform:string, actor?: string) {
    const secrets: MessageFromParent = [
      'secrets', {
        parentSecret1: this.parentSecret1,
        parentSecret2: this.parentSecret2
      }
    ];
    const platformInstance = new PlatformInstance({
      identifier: identifier,
      platform: platform,
      parentId: this.parentId,
      actor: actor
    });
    platformInstance.process.send(secrets);
    return platformInstance;
  }

  private ensureProcess(platform: string, sessionId?: string, actor?: string) {
    const identifier = getPlatformId(platform, actor);
    const platformInstance = SharedResources.platformInstances.get(identifier) ||
              this.createPlatformInstance(identifier, platform, actor);
    if (sessionId) {
      platformInstance.registerSession(sessionId);
    }
    SharedResources.platformInstances.set(identifier, platformInstance);
    return identifier;
  }
}

export default ProcessManager;