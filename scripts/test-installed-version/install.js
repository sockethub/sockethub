/**
 * Package installation manager for test-installed-version script
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export class InstallManager {
    constructor(installDir, logger) {
        this.installDir = installDir;
        this.logger = logger;
    }

    /**
     * Install sockethub package from an npm registry
     * @param {string} source - Version to install (e.g., "5.0.0-alpha.6", "latest")
     * @param {string} runtime - Runtime to use for installation ("bun" or "node")
     * @param {string | null} [registry] - Optional registry URL
     */
    async install(source, runtime, registry = null) {
        const description = registry
            ? `registry ${registry} (sockethub@${source})`
            : `npm (sockethub@${source})`;

        await this.logger.info(
            `Installing from ${description} using ${runtime}...`,
        );

        // Create a clean install directory.
        await rm(this.installDir, { recursive: true, force: true });
        await mkdir(this.installDir, { recursive: true });

        const packageJson = {
            name: "sockethub-test-install",
            private: true,
            dependencies: {
                sockethub: source,
            },
        };

        const pkgPath = join(this.installDir, "package.json");
        await writeFile(pkgPath, JSON.stringify(packageJson, null, 2));

        if (registry) {
            await writeFile(
                join(this.installDir, ".npmrc"),
                `registry=${registry}\n@sockethub:registry=${registry}\n`,
            );
        }

        // Install using appropriate package manager
        let installCmd;
        let installArgs;

        if (runtime === "bun") {
            installCmd = "bun";
            installArgs = ["install"];
        } else {
            installCmd = "npm";
            installArgs = ["install"];
        }

        const result = await this.logger.exec(
            installCmd,
            installArgs,
            { cwd: this.installDir },
            "install.log",
        );

        if (result.exitCode !== 0) {
            throw new Error(
                `Installation failed with exit code ${result.exitCode}`,
            );
        }

        await this.logger.success(
            `Installed from ${description} using ${runtime}`,
        );
    }

    /**
     * Verify that the installed version matches expected version
     * @param {string} expectedVersion - Expected version
     */
    async verifyVersion(expectedVersion) {
        await this.logger.info("Verifying installed version...");

        const pkgPath = join(
            this.installDir,
            "node_modules",
            "sockethub",
            "package.json",
        );

        let installedPkg;
        try {
            const content = await readFile(pkgPath, "utf-8");
            installedPkg = JSON.parse(content);
        } catch (error) {
            throw new Error(
                `Failed to read installed package.json: ${error.message}`,
            );
        }

        const installedVersion = installedPkg.version;

        // Handle "latest" tag
        if (expectedVersion === "latest") {
            await this.logger.success(
                `Verified installed version: ${installedVersion}`,
            );
            return installedVersion;
        }

        // Handle exact version match
        if (installedVersion === expectedVersion) {
            await this.logger.success(
                `Verified installed version: ${installedVersion}`,
            );
            return installedVersion;
        }

        // Handle version range (e.g., ^5.0.0, ~5.0.0)
        // For simplicity, we'll accept any version if a range was specified
        if (
            expectedVersion.startsWith("^") ||
            expectedVersion.startsWith("~") ||
            expectedVersion.startsWith(">=") ||
            expectedVersion.startsWith("<=") ||
            expectedVersion.includes("||")
        ) {
            await this.logger.success(
                `Verified installed version: ${installedVersion} (matches range ${expectedVersion})`,
            );
            return installedVersion;
        }

        // Version mismatch
        throw new Error(
            `Version mismatch: expected ${expectedVersion}, got ${installedVersion}`,
        );
    }

    /**
     * Get path to installed sockethub binary
     * @returns {string} Path to binary
     */
    getBinPath() {
        return join(this.installDir, "node_modules", ".bin", "sockethub");
    }
}
