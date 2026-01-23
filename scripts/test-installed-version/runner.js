/**
 * Test runner for test-installed-version script
 */

export class TestRunner {
    constructor(logger, runtime, version) {
        this.logger = logger;
        this.runtime = runtime;
        this.version = version;
        this.results = {
            runtime,
            version,
            passed: 0,
            failed: 0,
            totalDuration: 0,
            suites: [],
        };
    }

    /**
     * Run specified test suite(s)
     * @param {string} suite - Suite to run (process, browser, all)
     * @returns {object} Test results
     */
    async run(suite) {
        await this.logger.info(`Running ${suite} test suite(s)...`);

        const startTime = Date.now();

        try {
            switch (suite) {
                case "process":
                    await this.runProcessTests();
                    break;
                case "browser":
                    await this.runBrowserTests();
                    break;
                case "all":
                    await this.runProcessTests();
                    await this.runBrowserTests();
                    break;
                default:
                    throw new Error(`Unknown test suite: ${suite}`);
            }
        } catch (error) {
            await this.logger.error("Test execution failed", error);
            this.results.failed++;
        }

        this.results.totalDuration = Date.now() - startTime;

        return this.results;
    }

    /**
     * Run process integration tests
     */
    async runProcessTests() {
        await this.logger.info("Running process integration tests...");

        const startTime = Date.now();
        const result = await this.logger.exec(
            "bun",
            ["test", "./integration/process.integration.ts"],
            {},
            "integration-process.log",
        );

        const duration = Date.now() - startTime;
        const passed = result.exitCode === 0;

        this.results.suites.push({
            name: "process",
            passed,
            exitCode: result.exitCode,
            duration,
        });

        if (passed) {
            this.results.passed++;
            await this.logger.success(
                `Process tests passed (${Math.round(duration / 1000)}s)`,
            );
        } else {
            this.results.failed++;
            await this.logger.error(
                `Process tests failed (exit code ${result.exitCode})`,
            );
        }
    }

    /**
     * Run all browser integration tests
     */
    async runBrowserTests() {
        const browserTests = [
            {
                name: "browser-basic",
                file: "./integration/browser/basic.integration.js",
            },
            {
                name: "browser-multiclient",
                file: "./integration/browser/multiclient.integration.js",
            },
            {
                name: "browser-reconnection",
                file: "./integration/browser/reconnection.integration.js",
            },
            {
                name: "browser-resourceclash",
                file: "./integration/browser/resourceclash.integration.js",
            },
        ];

        for (const test of browserTests) {
            await this.runBrowserTest(test.name, test.file);
        }
    }

    /**
     * Run a single browser integration test
     * @param {string} name - Test name
     * @param {string} file - Test file path
     */
    async runBrowserTest(name, file) {
        await this.logger.info(`Running ${name} tests...`);

        const startTime = Date.now();
        const result = await this.logger.exec(
            "bun",
            ["integration/browser/test-runner.js", file],
            {
                env: {
                    ...process.env,
                    XMPP_HOST: "localhost",
                },
            },
            `integration-${name}.log`,
        );

        const duration = Date.now() - startTime;
        const passed = result.exitCode === 0;

        this.results.suites.push({
            name,
            passed,
            exitCode: result.exitCode,
            duration,
        });

        if (passed) {
            this.results.passed++;
            await this.logger.success(
                `${name} tests passed (${Math.round(duration / 1000)}s)`,
            );
        } else {
            this.results.failed++;
            await this.logger.error(
                `${name} tests failed (exit code ${result.exitCode})`,
            );
        }
    }
}
