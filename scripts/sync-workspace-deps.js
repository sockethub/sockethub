#!/usr/bin/env bun

/**
 * Sync workspace dependency versions across the monorepo
 *
 * This script ensures that workspace protocol dependencies with explicit versions
 * match the actual versions of the workspace packages after a version bump.
 *
 * Example: "@sockethub/client": "workspace:5.0.0-alpha.4" → "workspace:5.0.0-alpha.5"
 */

import { join } from "node:path";

const rootDir = process.cwd();
const rootPackageJsonPath = join(rootDir, "package.json");

// Read root package.json
const rootPackageJson = await Bun.file(rootPackageJsonPath).json();

// Find all workspace packages using Bun's glob
const workspacePatterns = rootPackageJson.workspaces || [];
const packageJsonPaths = [];
for (const pattern of workspacePatterns) {
    const glob = new Bun.Glob(join(pattern, "package.json"));
    for await (const path of glob.scan({ cwd: rootDir })) {
        packageJsonPaths.push(path);
    }
}

// Build a map of package names to their current versions
const packageVersions = new Map();
const workspacePackages = [];
for (const pkgPath of packageJsonPaths) {
    const fullPath = join(rootDir, pkgPath);
    const pkg = await Bun.file(fullPath).json();
    if (pkg.name && pkg.version) {
        packageVersions.set(pkg.name, pkg.version);
    }
    workspacePackages.push({ path: fullPath, pkg });
}

/**
 * Update workspace dependencies with explicit versions in a package.json object
 * @returns {boolean} Whether any updates were made
 */
function updateWorkspaceDeps(packageJson, label) {
    let updated = false;

    for (const depType of [
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies",
    ]) {
        if (!packageJson[depType]) continue;

        for (const [pkgName, currentVersion] of Object.entries(
            packageJson[depType],
        )) {
            // Check if it's a workspace protocol dependency with explicit version
            // Skip workspace:^, workspace:*, workspace:~ as they don't need updating
            if (
                typeof currentVersion === "string" &&
                currentVersion.startsWith("workspace:") &&
                !["workspace:^", "workspace:*", "workspace:~"].includes(
                    currentVersion,
                )
            ) {
                const actualVersion = packageVersions.get(pkgName);

                if (actualVersion) {
                    const expectedVersion = `workspace:${actualVersion}`;

                    if (currentVersion !== expectedVersion) {
                        console.log(
                            `[${label}] ${pkgName}: ${currentVersion} → ${expectedVersion}`,
                        );
                        packageJson[depType][pkgName] = expectedVersion;
                        updated = true;
                    }
                }
            }
        }
    }

    return updated;
}

let anyUpdated = false;

// Update workspace dependencies in root package.json
if (updateWorkspaceDeps(rootPackageJson, "root")) {
    await Bun.write(
        rootPackageJsonPath,
        `${JSON.stringify(rootPackageJson, null, 2)}\n`,
    );
    anyUpdated = true;
}

// Update workspace dependencies in each workspace package
for (const { path, pkg } of workspacePackages) {
    const label = pkg.name || path;
    if (updateWorkspaceDeps(pkg, label)) {
        await Bun.write(path, `${JSON.stringify(pkg, null, 2)}\n`);
        anyUpdated = true;
    }
}

if (anyUpdated) {
    console.log("\n✅ Workspace dependencies updated");
} else {
    console.log("✅ All workspace dependencies are already up to date");
}
