import init from './bootstrap/init';
import PlatformInstance, { platformInstances, PlatformInstanceParams } from "./platform-instance";
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

  get(platform: string, actorId: string, sessionId?: string): PlatformInstance {
    const platformDetails = init.platforms.get(platform);

    if (platformDetails.config.persist) {
      // ensure process is started - one for each actor
      return this.ensureProcess(platform, sessionId, actorId);
    } else {
      // ensure process is started - one for all jobs
      return this.ensureProcess(platform);
    }
  }

  private createPlatformInstance(identifier: string, platform: string,
                                 actor?: string): PlatformInstance {
    const secrets: MessageFromParent = [
      'secrets', {
        parentSecret1: this.parentSecret1,
        parentSecret2: this.parentSecret2
      }
    ];
    const platformInstanceConfig: PlatformInstanceParams = {
      identifier: identifier,
      platform: platform,
      parentId: this.parentId,
      actor: actor
    };
    const platformInstance = new PlatformInstance(platformInstanceConfig);
    platformInstance.initQueue(this.parentSecret1 + this.parentSecret2);
    platformInstance.process.send(secrets);
    return platformInstance;
  }

  private ensureProcess(platform: string, sessionId?: string, actor?: string): PlatformInstance {
    const identifier = getPlatformId(platform, actor);
    const platformInstance = platformInstances.get(identifier) ||
              this.createPlatformInstance(identifier, platform, actor);
    if (sessionId) {
      platformInstance.registerSession(sessionId);
    }
    platformInstances.set(identifier, platformInstance);
    return platformInstance;
  }
}

export default ProcessManager;