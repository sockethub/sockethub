import init from './bootstrap/init';
import SharedResources from "./shared-resources";
import PlatformInstance from "./platform-instance";
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

  private ensureProcess(platform: string, sessionId?: string, actor?: string) {
    const identifier = getPlatformId(platform, actor);
    const platformInstance = SharedResources.platformInstances.get(identifier) ||
        new PlatformInstance(identifier, platform, this.parentId, actor);

    const secrets: MessageFromParent = [
      'secrets', {
        parentSecret1: this.parentSecret1,
        parentSecret2: this.parentSecret2
      }
    ];
    platformInstance.process.send(secrets);

    if (sessionId) {
      platformInstance.registerSession(sessionId);
    }
    SharedResources.platformInstances.set(identifier, platformInstance);
    return identifier;
  }
}

export default ProcessManager;