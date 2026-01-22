/**
 * Logging system for test-installed-version script
 */

import { spawn } from "node:child_process";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export class Logger {
    constructor(outputDir, version, runtime, verbose = false) {
        this.version = version;
        this.runtime = runtime;
        this.verbose = verbose;

        // Create timestamped directory
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        this.logDir = join(
            outputDir,
            `sockethub-${version}-${runtime}-${timestamp}`,
        );
    }

    async init() {
        await mkdir(this.logDir, { recursive: true });
        await this.info(`Log directory: ${this.logDir}`);
    }

    getLogPath(filename) {
        return join(this.logDir, filename);
    }

    async info(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;

        console.log(message);
        await appendFile(this.getLogPath("master.log"), logMessage).catch(
            () => {
                // Ignore if master.log doesn't exist yet
            },
        );
    }

    async success(message) {
        await this.info(`✓ ${message}`);
    }

    async error(message, error) {
        const timestamp = new Date().toISOString();
        const errorMessage = error
            ? `${message}: ${error.message}\n${error.stack || ""}`
            : message;
        const logMessage = `[${timestamp}] ERROR: ${errorMessage}\n`;

        console.error(`✗ ${message}`);
        if (error) {
            console.error(error.message);
            if (this.verbose && error.stack) {
                console.error(error.stack);
            }
        }

        await appendFile(this.getLogPath("master.log"), logMessage).catch(
            () => {
                // Ignore if master.log doesn't exist yet
            },
        );
    }

    /**
     * Execute a command and capture output to log file
     * @param {string} command - Command to execute
     * @param {string[]} args - Command arguments
     * @param {object} options - Spawn options
     * @param {string} logFile - Log file name (optional)
     * @returns {Promise<{exitCode: number, stdout: string, stderr: string}>}
     */
    async exec(command, args = [], options = {}, logFile = null) {
        const cmdString = `${command} ${args.join(" ")}`;

        if (this.verbose) {
            await this.info(`Executing: ${cmdString}`);
        }

        return new Promise((resolve, reject) => {
            const proc = spawn(command, args, {
                ...options,
                stdio: this.verbose ? "inherit" : "pipe",
            });

            let stdout = "";
            let stderr = "";

            if (!this.verbose) {
                proc.stdout?.on("data", (data) => {
                    stdout += data.toString();
                    if (logFile) {
                        appendFile(
                            this.getLogPath(logFile),
                            data.toString(),
                        ).catch(() => {
                            // Ignore errors
                        });
                    }
                });

                proc.stderr?.on("data", (data) => {
                    stderr += data.toString();
                    if (logFile) {
                        appendFile(
                            this.getLogPath(logFile),
                            data.toString(),
                        ).catch(() => {
                            // Ignore errors
                        });
                    }
                });
            }

            proc.on("close", (exitCode) => {
                resolve({ exitCode, stdout, stderr });
            });

            proc.on("error", (error) => {
                reject(error);
            });
        });
    }

    /**
     * Spawn a background process and return the process object
     */
    spawn(command, args = [], options = {}, logFile = null) {
        const cmdString = `${command} ${args.join(" ")}`;

        if (this.verbose) {
            this.info(`Spawning: ${cmdString}`).catch(() => {});
        }

        const proc = spawn(command, args, {
            ...options,
            stdio: this.verbose ? "inherit" : "pipe",
        });

        if (!this.verbose && logFile) {
            proc.stdout?.on("data", (data) => {
                appendFile(this.getLogPath(logFile), data.toString()).catch(
                    () => {
                        // Ignore errors
                    },
                );
            });

            proc.stderr?.on("data", (data) => {
                appendFile(this.getLogPath(logFile), data.toString()).catch(
                    () => {
                        // Ignore errors
                    },
                );
            });
        }

        return proc;
    }

    async writeReport(results) {
        // Write JSON summary
        const summaryPath = this.getLogPath("summary.json");
        await writeFile(summaryPath, JSON.stringify(results, null, 2));

        // Write human-readable summary
        const lines = [
            "=".repeat(60),
            `Test Results: Sockethub ${results.version} (${results.runtime})`,
            "=".repeat(60),
            "",
            `Status: ${results.failed === 0 ? "✓ PASSED" : "✗ FAILED"}`,
            `Passed: ${results.passed}`,
            `Failed: ${results.failed}`,
            `Total Duration: ${Math.round(results.totalDuration / 1000)}s`,
            "",
            "Suite Results:",
            ...results.suites.map((suite) => {
                const status = suite.passed ? "✓" : "✗";
                const duration = Math.round(suite.duration / 1000);
                return `  ${status} ${suite.name.padEnd(20)} ${duration}s`;
            }),
            "",
            "=".repeat(60),
        ];

        const reportPath = this.getLogPath("report.txt");
        await writeFile(reportPath, lines.join("\n"));

        // Also output to console
        console.log(`\n${lines.join("\n")}`);
    }
}
