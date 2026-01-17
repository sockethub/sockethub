#!/usr/bin/env bun

/**
 * Sync workspace dependency versions in root package.json
 *
 * This script ensures that workspace protocol dependencies in the root package.json
 * match the actual versions of the workspace packages after a version bump.
 *
 * Example: "@sockethub/client": "workspace:5.0.0-alpha.4" → "workspace:5.0.0-alpha.5"
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";

const rootDir = process.cwd();
const rootPackageJsonPath = join(rootDir, "package.json");

// Read root package.json
const rootPackageJson = JSON.parse(readFileSync(rootPackageJsonPath, "utf-8"));

// Find all workspace packages
const workspacePatterns = rootPackageJson.workspaces || [];
const packageJsonPaths = workspacePatterns.flatMap((pattern) =>
    globSync(join(pattern, "package.json"), { cwd: rootDir }),
);

// Build a map of package names to their current versions
const packageVersions = new Map();
for (const pkgPath of packageJsonPaths) {
    const fullPath = join(rootDir, pkgPath);
    const pkg = JSON.parse(readFileSync(fullPath, "utf-8"));
    if (pkg.name && pkg.version) {
        packageVersions.set(pkg.name, pkg.version);
    }
}

let updated = false;

// Update workspace dependencies in root package.json
for (const depType of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
]) {
    if (!rootPackageJson[depType]) continue;

    for (const [pkgName, currentVersion] of Object.entries(
        rootPackageJson[depType],
    )) {
        // Check if it's a workspace protocol dependency
        if (
            typeof currentVersion === "string" &&
            currentVersion.startsWith("workspace:")
        ) {
            const actualVersion = packageVersions.get(pkgName);

            if (actualVersion) {
                const expectedVersion = `workspace:${actualVersion}`;

                if (currentVersion !== expectedVersion) {
                    console.log(
                        `Updating ${pkgName}: ${currentVersion} → ${expectedVersion}`,
                    );
                    rootPackageJson[depType][pkgName] = expectedVersion;
                    updated = true;
                }
            }
        }
    }
}

if (updated) {
    // Write back with consistent formatting (2 spaces, trailing newline)
    writeFileSync(
        rootPackageJsonPath,
        `${JSON.stringify(rootPackageJson, null, 2)}\n`,
        "utf-8",
    );
    console.log("\n✅ Root package.json workspace dependencies updated");
} else {
    console.log("✅ All workspace dependencies are already up to date");
}
