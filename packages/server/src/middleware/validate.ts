/**
 * responsible for handling the validation and expansion (when applicable) of all incoming objects
 */
import debug from 'debug';
import schemas, {IActivityStream, CallbackActivityStreamInterface} from '@sockethub/schemas';

import init from "../bootstrap/init";

init.platforms.forEach((platform) => {
  Object.keys(platform.schemas).forEach((key) => {
    if (! platform.schemas[key]) { return; }
    schemas.addPlatformSchema(platform.schemas[key], `${platform.id}/${key}`);
  });
});

// called when registered with the middleware function, define the type of validation
// that will be called when the middleware eventually does.
export default function validate(type: string, sockethubId: string) {
  const sessionLog = debug(`sockethub:server:validate:${sockethubId}`);
  return (msg: IActivityStream, done: CallbackActivityStreamInterface) => {
    sessionLog('applying schema validation for ' + type);
    if (type === 'activity-object') {
      const err = schemas.validateActivityObject(msg);
      err ? done(new Error(err)) : done(msg);
    } else if (! init.platforms.has(msg.context)) {
      return done(
        new Error(`platform context ${msg.context} not registered with this Sockethub instance.`)
      );
    } else if (type === 'credentials') {
      const err = schemas.validateCredentials(msg);
      err ? done(new Error(err)) : done(msg);
    } else {
      const err = schemas.validateActivityStream(msg);
      if (err) {
        done(new Error(err));
      } else {
        const platformMeta = init.platforms.get(msg.context);
        if (!platformMeta.types.includes(msg.type)) {
          return done(new Error(`platform type ${msg.type} not supported by ${msg.context} ` +
            `platform. (types: ${platformMeta.types.join(', ')})`));
        } else {
          done(msg);
        }
      }
    }
  };
}
