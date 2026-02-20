import {
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

type PlatformSchemaShape = {
    name: string;
    version: string;
    as2: {
        contextUrl: string;
        contextVersion: string;
        schemaVersion: string;
        messageConstraints?: object;
    };
    credentials?: object;
    messages?: object;
};

const AS2_BASE_CONTEXT_URL = "https://www.w3.org/ns/activitystreams";
const SOCKETHUB_BASE_CONTEXT_URL = "https://sockethub.org/ns/context/v1.jsonld";

const outputRoots = [resolve("./dist"), resolve("./src/generated")];

for (const root of outputRoots) {
    if (existsSync(root)) {
        rmSync(root, { recursive: true, force: true });
    }
    mkdirSync(root, { recursive: true });
}

const packageJson = JSON.parse(readFileSync(resolve("./package.json"), "utf8"));

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

const platformSchemas: Array<PlatformSchemaShape> = [
    (await import("../../platform-dummy/src/index.ts")).default.prototype
        .schema,
    (await import("../../platform-feeds/src/schema.ts")).default,
    (await import("../../platform-irc/src/schema.ts")).PlatformIrcSchema,
    (await import("../../platform-metadata/src/schema.ts"))
        .PlatformMetadataSchema,
    (await import("../../platform-xmpp/src/schema.js")).PlatformSchema,
];

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

for (const platform of platformSchemas) {
    const contextDoc = {
        "@context": {
            ...baseContext["@context"],
            [`${platform.name}Type`]: `sh:${platform.name}Type`,
        },
    };
    const contextRelativePath = `platform/${platform.name}/v${platform.as2.contextVersion}.jsonld`;
    const schemaRelativePath = `platform/${platform.name}/v${platform.as2.schemaVersion}/messages.schema.json`;
    const credentialsSchemaRelativePath = `platform/${platform.name}/v${platform.as2.schemaVersion}/credentials.schema.json`;

    contextToPlatformId[platform.as2.contextUrl] = platform.name;
    contextToSchemaId[platform.as2.contextUrl] =
        `https://sockethub.org/schemas/as2/${schemaRelativePath}`;
    contextToCredentialsSchemaId[platform.as2.contextUrl] =
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
