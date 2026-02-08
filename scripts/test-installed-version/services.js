/**
 * Service management for test-installed-version script
 */

import { CONFIG } from "./config.js";

export class ServiceManager {
    constructor(logger) {
        this.logger = logger;
        this.sockethubProcess = null;
        this.startedServices = [];
    }

    /**
     * Start required Docker services based on test suite
     * @param {string} suite - Test suite (browser, all)
     */
    async start(suite) {
        await this.logger.info(`Starting services for suite: ${suite}`);

        const needsRedis = ["all", "browser"].includes(suite);
        const needsXmpp = ["all", "browser"].includes(suite);

        if (needsRedis) {
            await this.startRedis();
        }

        if (needsXmpp) {
            await this.startXmpp();
        }
    }

    /**
     * Start Redis Docker container
     */
    async startRedis() {
        await this.logger.info("Starting Redis container...");

        const result = await this.logger.exec(
            "docker",
            ["compose", "up", "redis", "-d"],
            {},
            "redis.log",
        );

        if (result.exitCode !== 0) {
            throw new Error(`Failed to start Redis: ${result.stderr}`);
        }

        this.startedServices.push("redis");

        // Wait for Redis to be ready
        await this.waitForService(
            CONFIG.SERVICES.REDIS.host,
            CONFIG.SERVICES.REDIS.port,
            "Redis",
        );

        await this.logger.success("Redis is ready");
    }

    /**
     * Start Prosody XMPP Docker container
     */
    async startXmpp() {
        await this.logger.info("Starting Prosody XMPP container...");

        const result = await this.logger.exec(
            "docker",
            ["compose", "up", "prosody", "-d"],
            {},
            "prosody.log",
        );

        if (result.exitCode !== 0) {
            throw new Error(`Failed to start Prosody: ${result.stderr}`);
        }

        this.startedServices.push("prosody");

        // Wait for Prosody to be ready
        await this.waitForService(
            CONFIG.SERVICES.PROSODY.host,
            CONFIG.SERVICES.PROSODY.port,
            "Prosody",
        );

        // Wait for user creation to complete
        // Prosody's start.sh creates users after a 3s delay, so we wait 5s to be safe
        await this.logger.info("Waiting for Prosody user creation...");
        await new Promise((resolve) => setTimeout(resolve, 5000));

        await this.logger.success("Prosody is ready");
    }

    /**
     * Start Sockethub with the npm-installed binary
     * @param {string} binPath - Path to sockethub binary
     * @param {string} runtime - Runtime to use ("bun" or "node")
     */
    async startSockethub(binPath, runtime) {
        await this.logger.info(`Starting Sockethub with ${runtime} runtime...`);

        // Extract install directory from binPath
        // binPath is like "./test-install/node_modules/.bin/sockethub"
        // installDir should be "./test-install"
        const installDir = binPath.split("/node_modules/")[0];

        // Convert binPath to be relative to installDir
        const relativeBinPath = "node_modules/.bin/sockethub";

        // Choose the runtime command
        const command = runtime === "bun" ? "bun" : "node";

        // Get Sockethub info before starting
        await this.logger.info("Getting Sockethub info...");
        const infoResult = await this.logger.exec(
            command,
            [relativeBinPath, "--info"],
            { cwd: installDir },
            "sockethub-info.log",
        );

        if (infoResult.exitCode === 0) {
            // Display info output to console
            const infoOutput = infoResult.stdout.trim();
            console.log(`\n${infoOutput}\n`);
        } else {
            await this.logger.error("Failed to get Sockethub info");
        }

        // Spawn Sockethub process
        this.sockethubProcess = this.logger.spawn(
            command,
            [relativeBinPath],
            {
                cwd: installDir,
                env: {
                    ...process.env,
                    REDIS_URL: "redis://127.0.0.1:6379",
                    PORT: "10550",
                    DEBUG: "sockethub*",
                },
            },
            "sockethub.log",
        );

        // Handle process errors
        this.sockethubProcess.on("error", (error) => {
            this.logger.error("Sockethub process error", error).catch(() => {});
        });

        this.sockethubProcess.on("exit", (code) => {
            if (code !== 0 && code !== null) {
                this.logger
                    .error(`Sockethub process exited with code ${code}`)
                    .catch(() => {});
            }
        });

        // Wait for Sockethub to be ready
        await this.waitForService(
            CONFIG.SERVICES.SOCKETHUB.host,
            CONFIG.SERVICES.SOCKETHUB.port,
            "Sockethub",
        );

        await this.logger.success(
            `Sockethub is ready on port ${CONFIG.SERVICES.SOCKETHUB.port}`,
        );
    }

    /**
     * Wait for a service to be ready by checking if its port is listening
     * @param {string} host - Service host
     * @param {number} port - Service port
     * @param {string} name - Service name (for logging)
     */
    async waitForService(host, port, name) {
        const maxAttempts = 30;
        const delayMs = 1000;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const result = await this.logger.exec(
                    "nc",
                    ["-z", host, port.toString()],
                    {},
                    null,
                );

                if (result.exitCode === 0) {
                    return; // Service is ready
                }
            } catch (_error) {
                // nc command failed, service not ready yet
            }

            if (attempt < maxAttempts) {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }

        throw new Error(
            `${name} failed to start within ${maxAttempts} seconds`,
        );
    }

    /**
     * Stop all services
     */
    async stop() {
        await this.logger.info("Stopping services...");

        // Stop Sockethub process
        if (this.sockethubProcess) {
            try {
                this.sockethubProcess.kill("SIGTERM");
                await this.logger.info("Stopped Sockethub process");
            } catch (error) {
                await this.logger.error(
                    "Failed to stop Sockethub process",
                    error,
                );
            }
        }

        // Stop Docker services
        if (this.startedServices.length > 0) {
            try {
                const result = await this.logger.exec(
                    "docker",
                    ["compose", "down"],
                    {},
                    null,
                );

                if (result.exitCode !== 0) {
                    await this.logger.error(
                        "Failed to stop Docker services",
                        new Error(result.stderr),
                    );
                } else {
                    await this.logger.info("Stopped Docker services");
                }
            } catch (error) {
                await this.logger.error(
                    "Failed to stop Docker services",
                    error,
                );
            }
        }
    }
}
