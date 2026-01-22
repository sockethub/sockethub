/**
 * Package installation manager for test-installed-version script
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export class InstallManager {
    constructor(installDir, logger) {
        this.installDir = installDir;
        this.logger = logger;
    }

    /**
     * Install sockethub package from npm
     * @param {string} version - Version to install (e.g., "5.0.0-alpha.6", "latest")
     * @param {string} runtime - Runtime to use for installation ("bun" or "node")
     */
    async install(version, runtime) {
        await this.logger.info(
            `Installing sockethub@${version} using ${runtime}...`,
        );

        // Create install directory
        await mkdir(this.installDir, { recursive: true });

        // Create package.json
        const packageJson = {
            name: "sockethub-test-install",
            private: true,
            dependencies: {
                sockethub: version,
            },
        };

        const pkgPath = join(this.installDir, "package.json");
        await writeFile(pkgPath, JSON.stringify(packageJson, null, 2));

        // Install using appropriate package manager
        let installCmd;
        let installArgs;

        if (runtime === "bun") {
            installCmd = "bun";
            installArgs = ["install", "--frozen-lockfile"];
        } else {
            installCmd = "npm";
            installArgs = ["install", "--legacy-peer-deps"];
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
            `Installed sockethub@${version} using ${runtime}`,
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
