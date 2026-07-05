#!/usr/bin/env bun
/**
 * Stand-alone test runner for packaged Sockethub versions
 *
 * This script installs a specified version of Sockethub from an npm registry
 * and runs integration tests against it using either Bun or Node.js runtime.
 *
 * Usage:
 *   bun run scripts/test-installed-version.js <version> [options]
 *
 * Arguments:
 *   <version>              Version to test (e.g., "5.0.0-alpha.6", "latest")
 *
 * Options:
 *   --runtime <bun|node|both>  Runtime to test (default: "both")
 *   --suite <browser|all>  Test suite (default: "all")
 *   --registry <url>       Registry to install from (default: package manager default)
 *   --skip-install         Skip npm install
 *   --skip-cleanup         Don't remove resources after test
 *   --install-dir <path>   Installation directory (default: "./test-install")
 *   --output-dir <path>    Output directory (default: "./test-results")
 */

import { parseArgs } from "node:util";
import { cleanup } from "./test-installed-version/cleanup.js";
import { CONFIG } from "./test-installed-version/config.js";
import { InstallManager } from "./test-installed-version/install.js";
import { Logger } from "./test-installed-version/logger.js";
import { TestRunner } from "./test-installed-version/runner.js";
import { ServiceManager } from "./test-installed-version/services.js";

// Parse command-line arguments
const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
        runtime: { type: "string", default: CONFIG.DEFAULT_RUNTIME },
        suite: { type: "string", default: CONFIG.DEFAULT_SUITE },
        registry: { type: "string" },
        "skip-install": { type: "boolean", default: false },
        "skip-cleanup": { type: "boolean", default: false },
        "install-dir": { type: "string", default: CONFIG.DEFAULT_INSTALL_DIR },
        "output-dir": { type: "string", default: CONFIG.DEFAULT_OUTPUT_DIR },
    },
    allowPositionals: true,
});

// Validate version argument
const version = positionals[0];
if (!version) {
    console.error("Error: Version argument is required");
    console.error("");
    console.error(
        "Usage: bun run scripts/test-installed-version.js <version> [options]",
    );
    console.error("");
    console.error("Examples:");
    console.error("  bun run scripts/test-installed-version.js latest");
    console.error(
        "  bun run scripts/test-installed-version.js 5.0.0-alpha.6 --runtime bun",
    );
    console.error(
        "  bun run scripts/test-installed-version.js latest --suite browser",
    );
    console.error(
        "  bun run scripts/test-installed-version.js 5.0.0-alpha.12 --registry http://127.0.0.1:4873",
    );
    process.exit(1);
}

// Validate runtime
const validRuntimes = [
    CONFIG.RUNTIMES.BUN,
    CONFIG.RUNTIMES.NODE,
    CONFIG.RUNTIMES.BOTH,
];
if (!validRuntimes.includes(values.runtime)) {
    console.error(`Error: Invalid runtime: ${values.runtime}`);
    console.error(`Must be one of: ${validRuntimes.join(", ")}`);
    process.exit(1);
}

// Validate suite
const validSuites = [
    CONFIG.SUITES.REDIS,
    CONFIG.SUITES.PROCESS,
    CONFIG.SUITES.BROWSER,
    CONFIG.SUITES.ALL,
];
if (!validSuites.includes(values.suite)) {
    console.error(`Error: Invalid test suite: ${values.suite}`);
    console.error(`Must be one of: ${validSuites.join(", ")}`);
    process.exit(1);
}

/**
 * Run tests for a single runtime
 */
async function runTestsForRuntime(
    runtime,
    isFirstRun,
    actualVersion,
    installSource,
    registry = null,
) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Testing with runtime: ${runtime.toUpperCase()}`);
    console.log("=".repeat(60));

    const logger = new Logger(values["output-dir"], actualVersion, runtime);

    await logger.init();

    let services;
    let installer;

    try {
        // Install (if needed)
        if (!values["skip-install"] || isFirstRun) {
            installer = new InstallManager(values["install-dir"], logger);

            await installer.install(installSource, runtime, registry);
            const installedVersion =
                await installer.verifyVersion(actualVersion);

            // Update version in results if a dist-tag was used.
            if (installSource === "latest") {
                logger.version = installedVersion;
            }
        } else {
            await logger.info("Skipping installation (--skip-install)");
            installer = new InstallManager(values["install-dir"], logger);
        }

        // Start services
        services = new ServiceManager(logger);
        await services.start(values.suite);

        // Start Sockethub with correct runtime
        const sockethubBin = installer.getBinPath();
        await services.startSockethub(sockethubBin, runtime);

        // Run tests
        const runner = new TestRunner(logger, runtime, logger.version);
        const results = await runner.run(values.suite);

        // Write report
        await logger.writeReport(results);

        // Cleanup
        if (!values["skip-cleanup"]) {
            await cleanup(services, values["install-dir"], logger);
        } else {
            await services.stop();
            await logger.info("Skipping cleanup (--skip-cleanup)");
        }

        return results;
    } catch (error) {
        await logger.error("Fatal error", error);

        // Try to stop services even on error
        if (services) {
            try {
                await services.stop();
            } catch (_stopError) {
                // Ignore cleanup errors
            }
        }

        return {
            runtime,
            version: logger.version,
            failed: 1,
            passed: 0,
            error: error.message,
            suites: [],
            totalDuration: 0,
        };
    }
}

/**
 * Main function
 */
async function main() {
    console.log("=".repeat(60));
    console.log("Sockethub NPM Version Test Runner");
    console.log("=".repeat(60));

    const installSource = version;
    const actualVersion = version;

    console.log(`Version: ${version}`);
    if (values.registry) {
        console.log(`Registry: ${values.registry}`);
    }

    console.log(`Runtime(s): ${values.runtime}`);
    console.log(`Test suite: ${values.suite}`);
    console.log("=".repeat(60));

    // Determine which runtimes to test
    const runtimes =
        values.runtime === CONFIG.RUNTIMES.BOTH
            ? [CONFIG.RUNTIMES.BUN, CONFIG.RUNTIMES.NODE]
            : [values.runtime];

    const allResults = [];

    // Run tests for each runtime
    for (let i = 0; i < runtimes.length; i++) {
        const runtime = runtimes[i];
        const isFirstRun = i === 0;
        const result = await runTestsForRuntime(
            runtime,
            isFirstRun,
            actualVersion,
            installSource,
            values.registry,
        );
        allResults.push(result);
    }

    // Print final summary if testing multiple runtimes
    if (runtimes.length > 1) {
        console.log(`\n${"=".repeat(60)}`);
        console.log("FINAL SUMMARY - ALL RUNTIMES");
        console.log("=".repeat(60));

        for (const result of allResults) {
            const status = result.failed === 0 ? "✓ PASSED" : "✗ FAILED";
            const runtime = result.runtime.toUpperCase().padEnd(6);
            console.log(`${runtime}: ${status}`);
        }

        console.log("=".repeat(60));
    }

    // Exit with failure if any runtime failed
    const totalFailed = allResults.reduce((sum, r) => sum + (r.failed || 0), 0);
    process.exit(totalFailed > 0 ? 1 : 0);
}

// Run main function
main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
});
