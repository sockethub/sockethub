import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import {
    AS2_BASE_CONTEXT_URL,
    ERROR_PLATFORM_CONTEXT_URL,
    ERROR_PLATFORM_ID,
    INTERNAL_PLATFORM_CONTEXT_URL,
    INTERNAL_PLATFORM_ID,
    SOCKETHUB_BASE_CONTEXT_URL,
} from "../src/context.ts";

type PlatformSchemaShape = {
    name: string;
    version: string;
    contextUrl: string;
    contextVersion: string;
    schemaVersion: string;
    messageConstraints?: object;
    credentials?: object;
    messages?: object;
};

type PlatformPackageJson = {
    name?: string;
    exports?: {
        "."?: {
            bun?: string;
        };
    };
};

type PlatformConstructor = new (
    session: Record<string, unknown>,
) => {
    schema: PlatformSchemaShape;
};

const outputRoots = [resolve("./dist"), resolve("./src/generated")];

for (const root of outputRoots) {
    // These directories are fully generated artifacts and are intentionally rebuilt from scratch.
    if (existsSync(root)) {
        rmSync(root, { recursive: true, force: true });
    }
    mkdirSync(root, { recursive: true });
}

const packageJson = JSON.parse(readFileSync(resolve("./package.json"), "utf8"));
const packagesRootDir = resolve("../../packages");

const contextsDir = resolve("./dist/contexts");
const schemasDir = resolve("./dist/schemas");
const mapsDir = resolve("./dist/maps");
mkdirSync(contextsDir, { recursive: true });
mkdirSync(schemasDir, { recursive: true });
mkdirSync(mapsDir, { recursive: true });

const srcGeneratedContextsDir = resolve("./src/generated/contexts");
const srcGeneratedSchemasDir = resolve("./src/generated/schemas");
const srcGeneratedMapsDir = resolve("./src/generated/maps");
mkdirSync(srcGeneratedContextsDir, { recursive: true });
mkdirSync(srcGeneratedSchemasDir, { recursive: true });
mkdirSync(srcGeneratedMapsDir, { recursive: true });

async function loadPlatformSchemas(): Promise<Array<PlatformSchemaShape>> {
    const platformDirs = readdirSync(packagesRootDir, { withFileTypes: true })
        .filter(
            (entry) =>
                entry.isDirectory() && entry.name.startsWith("platform-"),
        )
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));

    const noop = () => {};
    const fakeSession = {
        log: {
            error: noop,
            warn: noop,
            info: noop,
            debug: noop,
        },
        sendToClient: noop,
        updateActor: async () => {},
    };

    const loadedSchemas: Array<PlatformSchemaShape> = [];

    for (const platformDir of platformDirs) {
        const packagePath = resolve(
            packagesRootDir,
            platformDir,
            "package.json",
        );
        if (!existsSync(packagePath)) {
            continue;
        }

        const pkg = JSON.parse(
            readFileSync(packagePath, "utf8"),
        ) as PlatformPackageJson;
        if (!pkg.name?.startsWith("@sockethub/platform-")) {
            continue;
        }

        const bunEntry = pkg.exports?.["."]?.bun;
        if (typeof bunEntry !== "string") {
            throw new Error(
                `missing exports["."].bun entry for package ${pkg.name ?? platformDir}`,
            );
        }

        const modulePath = resolve(packagesRootDir, platformDir, bunEntry);
        const imported = await import(modulePath);
        if (typeof imported.default !== "function") {
            throw new Error(
                `platform package ${pkg.name ?? platformDir} does not export a default class`,
            );
        }

        const PlatformClass = imported.default as PlatformConstructor;
        const platform = new PlatformClass(fakeSession);
        if (!platform?.schema?.contextUrl) {
            throw new Error(
                `platform package ${pkg.name ?? platformDir} does not expose canonical schema context metadata`,
            );
        }

        loadedSchemas.push(platform.schema);
    }

    return loadedSchemas;
}

const platformSchemas = await loadPlatformSchemas();

const systemSchemas: Array<PlatformSchemaShape> = [
    {
        name: ERROR_PLATFORM_ID,
        version: packageJson.version,
        contextUrl: ERROR_PLATFORM_CONTEXT_URL,
        contextVersion: "1",
        schemaVersion: "1",
        messages: {},
        credentials: {},
    },
    {
        name: INTERNAL_PLATFORM_ID,
        version: packageJson.version,
        contextUrl: INTERNAL_PLATFORM_CONTEXT_URL,
        contextVersion: "1",
        schemaVersion: "1",
        messages: {},
        credentials: {},
    },
];

const allSchemas = [...platformSchemas, ...systemSchemas].sort((a, b) =>
    a.name.localeCompare(b.name),
);

const baseContext = {
    "@context": {
        as: "https://www.w3.org/ns/activitystreams#",
        sh: "https://sockethub.org/ns#",
        platform: "sh:platform",
    },
};

const contextToPlatformId: Record<string, string> = {};
const contextToSchemaId: Record<string, string> = {};
const contextToCredentialsSchemaId: Record<string, string> = {};

for (const platform of allSchemas) {
    const contextDoc = {
        "@context": {
            ...baseContext["@context"],
            [`${platform.name}Type`]: `sh:${platform.name}Type`,
        },
    };

    const contextRelativePath = `platform/${platform.name}/v${platform.contextVersion}.jsonld`;
    const schemaRelativePath = `platform/${platform.name}/v${platform.schemaVersion}/messages.schema.json`;
    const credentialsSchemaRelativePath = `platform/${platform.name}/v${platform.schemaVersion}/credentials.schema.json`;

    contextToPlatformId[platform.contextUrl] = platform.name;
    contextToSchemaId[platform.contextUrl] =
        `https://sockethub.org/schemas/as2/${schemaRelativePath}`;
    contextToCredentialsSchemaId[platform.contextUrl] =
        `https://sockethub.org/schemas/as2/${credentialsSchemaRelativePath}`;

    const distContextPath = resolve(contextsDir, contextRelativePath);
    mkdirSync(dirname(distContextPath), { recursive: true });
    writeFileSync(distContextPath, JSON.stringify(contextDoc, null, 2));

    const srcContextPath = resolve(
        srcGeneratedContextsDir,
        contextRelativePath,
    );
    mkdirSync(dirname(srcContextPath), { recursive: true });
    writeFileSync(srcContextPath, JSON.stringify(contextDoc, null, 2));

    const distSchemaPath = resolve(schemasDir, schemaRelativePath);
    mkdirSync(dirname(distSchemaPath), { recursive: true });
    writeFileSync(
        distSchemaPath,
        JSON.stringify(platform.messages ?? {}, null, 2),
    );

    const srcSchemaPath = resolve(srcGeneratedSchemasDir, schemaRelativePath);
    mkdirSync(dirname(srcSchemaPath), { recursive: true });
    writeFileSync(
        srcSchemaPath,
        JSON.stringify(platform.messages ?? {}, null, 2),
    );

    const distCredsSchemaPath = resolve(
        schemasDir,
        credentialsSchemaRelativePath,
    );
    mkdirSync(dirname(distCredsSchemaPath), { recursive: true });
    writeFileSync(
        distCredsSchemaPath,
        JSON.stringify(platform.credentials ?? {}, null, 2),
    );

    const srcCredsSchemaPath = resolve(
        srcGeneratedSchemasDir,
        credentialsSchemaRelativePath,
    );
    mkdirSync(dirname(srcCredsSchemaPath), { recursive: true });
    writeFileSync(
        srcCredsSchemaPath,
        JSON.stringify(platform.credentials ?? {}, null, 2),
    );
}

const baseContextRelativePath = "v1.jsonld";
writeFileSync(
    resolve(contextsDir, baseContextRelativePath),
    JSON.stringify(baseContext, null, 2),
);
writeFileSync(
    resolve(srcGeneratedContextsDir, baseContextRelativePath),
    JSON.stringify(baseContext, null, 2),
);

const contextMapDoc = {
    schemaVersion: packageJson.version,
    generatedAt: new Date().toISOString(),
    contextToPlatformId,
    contextToSchemaId,
    contextToCredentialsSchemaId,
    constants: {
        as2: AS2_BASE_CONTEXT_URL,
        sockethub: SOCKETHUB_BASE_CONTEXT_URL,
    },
};

writeFileSync(
    resolve(mapsDir, "context-map.json"),
    JSON.stringify(contextMapDoc, null, 2),
);
writeFileSync(
    resolve(srcGeneratedMapsDir, "context-map.json"),
    JSON.stringify(contextMapDoc, null, 2),
);
