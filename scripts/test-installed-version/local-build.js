/**
 * Local package building and packing for test-installed-version script
 */

import { execFileSync, execSync } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Build and pack packages locally for testing
 * @param {Logger} logger - Logger instance
 * @returns {Promise<{version: string, tarballsDir: string}>} Version and directory containing tarballs
 */
export async function buildAndPackLocally(logger) {
    await logger.info("Building all packages...");

    const repoRoot = process.cwd();
    const packagesDir = join(repoRoot, "packages");
    const tarballsDir = join(repoRoot, ".local-tarballs");

    // Build all packages
    try {
        execSync("bun run build", {
            cwd: repoRoot,
            stdio: "inherit",
        });
        await logger.success("Built all packages");
    } catch (error) {
        throw new Error(`Build failed: ${error.message}`);
    }

    // Clean and create tarballs directory without using a shell
    await rm(tarballsDir, { recursive: true, force: true });
    await mkdir(tarballsDir, { recursive: true });

    // Get list of all packages
    const packageDirs = await readdir(packagesDir);
    const tarballs = new Map(); // packageName -> tarballPath

    await logger.info("Packing all workspace packages...");

    // Pack each package
    for (const dir of packageDirs) {
        const pkgDir = join(packagesDir, dir);
        const pkgJsonPath = join(pkgDir, "package.json");

        try {
            const pkgJson = JSON.parse(await readFile(pkgJsonPath, "utf-8"));

            // Skip private packages
            if (pkgJson.private) continue;

            const output = execFileSync("bun", ["pm", "pack"], {
                cwd: pkgDir,
                encoding: "utf-8",
            });

            const tarballName = output.trim().split("\n").pop();
            const tarballPath = join(pkgDir, tarballName);

            // Move to tarballs directory
            execFileSync("mv", [tarballPath, `${tarballsDir}/`], {
                cwd: repoRoot,
            });
            tarballs.set(pkgJson.name, join(tarballsDir, tarballName));

            await logger.info(`  ✓ ${pkgJson.name}`);
        } catch (_) {
            // Skip if package.json doesn't exist
        }
    }

    await logger.success(`Packed ${tarballs.size} packages`);

    // Get sockethub version
    const sockethubPkgPath = join(packagesDir, "sockethub/package.json");
    const sockethubPkg = JSON.parse(await readFile(sockethubPkgPath, "utf-8"));
    const version = sockethubPkg.version;

    // Create a modified sockethub package.json that references local tarballs
    await logger.info("Creating local package configuration...");

    const modifiedPkg = { ...sockethubPkg };

    // Replace all @sockethub/* dependencies with file: references
    for (const [depName, tarballPath] of tarballs.entries()) {
        if (modifiedPkg.dependencies?.[depName]) {
            modifiedPkg.dependencies[depName] = `file:${tarballPath}`;
        }
        if (modifiedPkg.optionalDependencies?.[depName]) {
            modifiedPkg.optionalDependencies[depName] = `file:${tarballPath}`;
        }
    }

    // Write modified package.json
    const modifiedPkgPath = join(tarballsDir, "package.json");
    await writeFile(modifiedPkgPath, JSON.stringify(modifiedPkg, null, 2));

    // Copy bin script
    await cp(join(packagesDir, "sockethub/bin"), join(tarballsDir, "bin"), {
        recursive: true,
    });
    await logger.success("Created local package configuration");

    // Pack the modified sockethub package as a tarball
    await logger.info("Packing modified sockethub package...");
    const packOutput = execFileSync("bun", ["pm", "pack"], {
        cwd: tarballsDir,
        encoding: "utf-8",
    });

    const sockethubTarball = packOutput.trim().split("\n").pop();
    const sockethubTarballPath = join(tarballsDir, sockethubTarball);

    await logger.success(`Created sockethub tarball: ${sockethubTarball}`);

    return {
        version,
        tarballPath: sockethubTarballPath,
    };
}
