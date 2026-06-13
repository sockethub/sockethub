#!/usr/bin/env node
/**
 * Emit TypeScript declaration files for published package entrypoints.
 *
 * Bun's bundler emits JavaScript only, so package builds run this script once
 * after JavaScript bundles are written. Workspace development still resolves
 * package imports to src/ through tsconfig paths; these declarations are for
 * installed package consumers.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const packages = [
    {
        dir: "packages/client",
        entries: ["src/sockethub-client.ts"],
    },
    {
        dir: "packages/crypto",
        entries: ["src/index.ts"],
    },
    {
        dir: "packages/data-layer",
        entries: ["src/index.ts"],
    },
    {
        dir: "packages/irc2as",
        entries: ["src/index.js"],
        allowJs: true,
    },
    {
        dir: "packages/logger",
        entries: ["src/index.ts"],
    },
    {
        dir: "packages/platform-dummy",
        entries: ["src/index.ts"],
    },
    {
        dir: "packages/platform-feeds",
        entries: ["src/index.ts"],
    },
    {
        dir: "packages/platform-irc",
        entries: ["src/index.ts"],
    },
    {
        dir: "packages/platform-metadata",
        entries: ["src/index.ts"],
    },
    {
        dir: "packages/platform-xmpp",
        entries: ["src/index.ts"],
    },
    {
        dir: "packages/schemas",
        entries: [
            "src/index.ts",
            "src/context.ts",
            "src/object-types.ts",
            "src/activity-stream-helper.ts",
        ],
    },
    {
        dir: "packages/server",
        entries: ["src/index.ts", "src/platform.ts"],
    },
    {
        dir: "packages/util",
        entries: ["src/index.ts", "src/net/index.ts"],
    },
];

const repoRoot = process.cwd();
const localTsc = join(repoRoot, "node_modules", ".bin", "tsc");
const command = existsSync(localTsc) ? localTsc : "bunx";
const commandPrefix = existsSync(localTsc) ? [] : ["tsc"];

for (const pkg of packages) {
    console.log(`Generating declarations for ${pkg.dir}`);

    const result = spawnSync(
        command,
        [
            ...commandPrefix,
            "--declaration",
            "--emitDeclarationOnly",
            "--declarationMap",
            "false",
            "--noCheck",
            "--outDir",
            join(pkg.dir, "dist"),
            "--rootDir",
            join(pkg.dir, "src"),
            "--baseUrl",
            ".",
            "--module",
            "ESNext",
            "--moduleResolution",
            "Bundler",
            "--target",
            "ES2022",
            "--lib",
            "ESNext,DOM",
            "--types",
            "bun",
            ...(pkg.allowJs ? ["--allowJs", "true"] : []),
            "--skipLibCheck",
            "true",
            "--esModuleInterop",
            "true",
            "--allowSyntheticDefaultImports",
            "true",
            "--resolveJsonModule",
            "true",
            ...pkg.entries.map((entry) => join(pkg.dir, entry)),
        ],
        {
            cwd: repoRoot,
            stdio: "inherit",
        },
    );

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}
