/**
 * bootstrap/platforms.ts
 *
 * A Singleton responsible for finding and loading all valid Sockethub
 * platforms, and whitelisting or blacklisting (or neither) based on the
 * config.
 */
import debug from "debug";
import schemas from "@sockethub/schemas";
import type {
  PlatformConfig,
  PlatformConstructor,
  PlatformInterface,
  PlatformSchemaStruct,
  PlatformSession,
} from "@sockethub/schemas";

const log = debug("sockethub:server:bootstrap:platforms");

log("loading platforms");

export interface PlatformImport {
  id: string;
  moduleName: string;
  config: PlatformConfig;
  schema: PlatformSchemaStruct;
  version: string;
  types: Array<string>;
}

export type PlatformMap = Map<
  string,
  PlatformImport
>;

export type RequireFunction = (moduleName: string) => PlatformConstructor<PlatformImport>;

const dummySession: PlatformSession = {
  debug: () => {},
  sendToClient: () => {},
  updateActor: async () => {},
};

// if the platform schema lists valid types it implements (essentially methods/verbs for
// Sockethub to call) then add it to the supported types list.
function platformListsSupportedTypes(p: PlatformInterface): boolean {
  return (
    p.schema.messages.properties &&
    p.schema.messages.properties.type &&
    p.schema.messages.properties.type.enum &&
    p.schema.messages.properties.type.enum.length > 0
  );
}

async function loadPlatform(platformName: string, injectRequire: RequireFunction): Promise<PlatformInterface> {
  let p;
  if (injectRequire) {
    const P = await injectRequire(platformName);
    p = new P({} as PlatformSession);
  } else {
    const P = await import(platformName);
    p = new P.default(dummySession);
  }
  const err = schemas.validatePlatformSchema(p.schema);

  if (err) {
    throw new Error(`${platformName} ${err}`);
  } else if (typeof p.config !== "object") {
    throw new Error(
      `${platformName} platform must have a config property that is an object.`,
    );
  }
  return p;
}

export default async function loadPlatforms(
  platformsList: Array<string>,
  injectRequire?: RequireFunction,
): Promise<PlatformMap> {
  // load platforms from config.platforms
  const platforms = new Map();

  if (platformsList.length <= 0) {
    throw new Error(
      "No platforms defined. Please check your sockethub.config.json",
    );
  }

  for (const platformName of platformsList) {
    log(`loading ${platformName}`);
    const p = await loadPlatform(platformName, injectRequire as RequireFunction);
    let types = [];

    if (p.schema.credentials) {
      // register the platforms credentials schema
      types.push("credentials");
    } else {
      p.config.requireCredentials = false;
    }

    if (platformListsSupportedTypes(p)) {
      types = [...types, ...p.schema.messages.properties.type.enum];
    }

    platforms.set(p.schema.name, {
      id: p.schema.name,
      moduleName: p.schema.name,
      config: p.config,
      schemas: {
        credentials: p.schema.credentials || {},
        messages: p.schema.messages || {},
      },
      version: p.schema.version,
      types: types,
    });
  }

  return platforms;
}
