import PlatformInstance, {
  platformInstances, PlatformInstanceParams, MessageFromParent, PlatformConfig
} from "./platform-instance";
import {getPlatformId} from "@sockethub/crypto";
import { IInitObject } from "./bootstrap/init";


class ProcessManager {
  private readonly parentId: string;
  private readonly parentSecret1: string;
  private readonly parentSecret2: string;
  private init: IInitObject;

  constructor(parentId: string, parentSecret1: string, parentSecret2: string, init: IInitObject) {
    this.parentId = parentId;
    this.parentSecret1 = parentSecret1;
    this.parentSecret2 = parentSecret2;
    this.init = init;
  }

  get(platform: string, actorId: string, sessionId?: string): PlatformInstance {
    const platformDetails = this.init.platforms.get(platform);
    let pi;

    if (platformDetails?.config.persist) {
      // ensure process is started - one for each actor
      pi = this.ensureProcess(platform, platformDetails?.config || {}, sessionId, actorId);
    } else {
      // ensure process is started - one for all jobs
      pi = this.ensureProcess(platform, platformDetails?.config || {});
    }
    return pi;
  }

  private createPlatformInstance(identifier: string, platform: string,
                                 config: PlatformConfig,
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
      config: config,
      actor: actor
    };
    const platformInstance = new PlatformInstance(platformInstanceConfig);
    platformInstance.initQueue(this.parentSecret1 + this.parentSecret2);
    platformInstance.process.send(secrets);
    return platformInstance;
  }

  private ensureProcess(
    platform: string,
    config: PlatformConfig,
    sessionId?: string,
    actor?: string
  ): PlatformInstance {
    const identifier = getPlatformId(platform, actor);
    const platformInstance = platformInstances.get(identifier) ||
              this.createPlatformInstance(identifier, platform, config, actor);
    if (sessionId) {
      platformInstance.registerSession(sessionId);
    }
    platformInstances.set(identifier, platformInstance);
    return platformInstance;
  }
}

export default ProcessManager;
