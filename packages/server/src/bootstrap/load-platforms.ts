/**
 * bootstrap/platforms.js
 *
 * A Singleton responsible for finding and loading all valid Sockethub
 * platforms, and whitelisting or blacklisting (or neither) based on the
 * config.
 */
import debug from "debug";
import schemas from "@sockethub/schemas";

const log = debug('sockethub:server:bootstrap:platforms');

log('loading platforms');

class InjectedClass {}
type InjectedRequire = (p: string) => typeof InjectedClass;

interface SchemaStruct {
  properties?: {
    required: Array<string>;
    type?: {
      enum: Array<string>;
    };
  }
}
interface PlatformStruct {
  id: string;
  moduleName: string;
  config: {
    persist?: boolean;
  };
  schema: {
    credentials: SchemaStruct;
    messages: SchemaStruct;
  };
  version: string;
  types: Array<string>;
}
export type PlatformMap = Map<string, PlatformStruct>;

// if the platform schema lists valid types it implements (essentially methods/verbs for
// Sockethub to call) then add it to the supported types list.
function getSupportedTypes(p: PlatformStruct): Array<string> {
  const types = p.schema.messages.properties?.type?.enum;
  return Array.isArray(types) ? types : [];
}

async function loadPlatform(platformName: string, injectRequire: InjectedRequire | undefined) {
  let p;
  if (injectRequire) {
    const P = await injectRequire(platformName);
    p = new P();
  } else {
    // eslint-disable-next-line security-node/detect-non-literal-require-calls
    const P = await import(platformName);
    p = new P.default();
  }
  const err = schemas.validatePlatformSchema(p.schema);

  if (err) {
    throw new Error(`${platformName} ${err}`);
  } else if (typeof p.config !== 'object') {
    throw new Error(
      `${platformName} platform must have a config property that is an object.`);
  }
  return p;
}

export default async function loadPlatforms(
  platformsList: Array<string>, injectRequire = undefined
): Promise<PlatformMap> {
  // load platforms from config.platforms
  const platforms = new Map();

  if (platformsList.length <= 0) {
    throw new Error('No platforms defined. Please check your sockethub.config.json');
  }

  for (const platformName of platformsList) {
    log(`loading ${platformName}`);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const p = await loadPlatform(platformName, injectRequire);
    let types = [];

    if (p.schema.credentials) {
      // register the platforms credentials schema
      types.push('credentials');
    } else {
      p.config.noCredentials = true;
    }

    types = [...types, ...getSupportedTypes(p)];

    platforms.set(p.schema.name, {
      id: p.schema.name,
      moduleName: p.schema.name,
      config: p.config,
      schemas: {
        credentials: p.schema.credentials || {},
        messages: p.schema.messages || {}
      },
      version: p.schema.version,
      types: types
    });
  }

  return platforms;
}
