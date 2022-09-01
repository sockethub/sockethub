/**
 * responsible for handling the validation and expansion (when applicable) of all incoming objects
 */
import debug from 'debug';
import schemas, {IActivityStream} from '@sockethub/schemas';

import init from "../bootstrap/init";
import {MiddlewareChainInterface} from "../middleware";

init.platforms.forEach((platform) => {
  Object.keys(platform.schemas).forEach((key) => {
    if (! platform.schemas[key]) { return; }
    schemas.addPlatformSchema(platform.schemas[key], `${platform.id}/${key}`);
  });
});

/**
 * Called when registered with the middleware function, define the type of validation
 * that will be called when the middleware eventually does.
 * @param type
 * @param sockethubId
 */
export default function validateWrapper(
  type: string, sockethubId: string
): MiddlewareChainInterface {
  const sessionLog = debug(`sockethub:server:validate:${sockethubId}`);
  return async (msg: IActivityStream): Promise<IActivityStream> => {
    sessionLog('applying schema validation for ' + type);
    if (type === 'activity-object') {
      const err = schemas.validateActivityObject(msg);
      if (err) {
        throw new Error(err);
      } else {
        return msg;
      }
    } else if (! init.platforms.has(msg.context)) {
      throw new Error(
        `platform context ${msg.context} not registered with this Sockethub instance.`);
    } else if (type === 'credentials') {
      const err = schemas.validateCredentials(msg);
      if (err) {
        throw new Error(err);
      } else {
        return msg;
      }
    } else {
      const err = schemas.validateActivityStream(msg);
      if (err) {
        throw new Error(err);
      } else {
        const platformMeta = init.platforms.get(msg.context);
        if (!platformMeta.types.includes(msg.type)) {
          throw new Error(`platform type ${msg.type} not supported by ${msg.context} ` +
            `platform. (types: ${platformMeta.types.join(', ')})`);
        }
      }
    }
    return msg;
  };
}
