import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { join } from "node:path";
import { type Socket, io } from "socket.io-client";
import config from "./config.js";
import createTestUtils from "./utils.js";

const utils = createTestUtils(config);

interface TestConfig {
    sockethubProcess?: ChildProcess;
    client?: Socket;
    platformChildPid?: number;
    dummyChildPid?: number;
    sockethubLogs: string[];
    isVerbose: boolean;
}

const isProcessRunning = (pid: number | undefined) => {
    if (!pid) {
        return false;
    }
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
};

const findPlatformChildProcesses = async (options?: {
    platformName?: string;
    excludeNames?: string[];
}): Promise<number[]> => {
    const platformName = options?.platformName;
    const excludeNames = options?.excludeNames ?? [];
    return new Promise<number[]>((resolve) => {
        const ps = spawn("ps", ["-o", "pid,ppid,command"], {
            stdio: ["ignore", "pipe", "pipe"],
        });
        let output = "";

        ps.stdout.on("data", (data) => {
            output += data.toString();
        });

        ps.on("close", () => {
            const lines = output.split("\n");
            const childPids: number[] = [];

            for (const line of lines.slice(1)) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 3) {
                    const pid = Number.parseInt(parts[0]);
                    const command = parts.slice(2).join(" ");

                    const hasPlatformScript = command.includes("platform.js");
                    const matchesPlatform = platformName
                        ? command.includes(platformName)
                        : true;
                    const isExcluded = excludeNames.some((name) =>
                        command.includes(name),
                    );
                    if (hasPlatformScript && matchesPlatform && !isExcluded) {
                        childPids.push(pid);
                    }
                }
            }
            resolve(childPids);
        });

        ps.on("error", () => {
            resolve([]);
        });
    });
};

const waitForPlatformChildProcesses = async (
    options: {
        platformName?: string;
        excludeNames?: string[];
        allowAnyPlatformFallback?: boolean;
    },
    timeoutMs: number,
) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        let childPids = await findPlatformChildProcesses(options);
        if (childPids.length > 0) {
            return childPids;
        }
        if (options.platformName && options.allowAnyPlatformFallback) {
            childPids = await findPlatformChildProcesses({
                excludeNames: options.excludeNames,
            });
            if (childPids.length > 0) {
                return childPids;
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return [];
};

const waitForProcessExit = async (pid: number, timeoutMs: number) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (!isProcessRunning(pid)) {
            return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return false;
};

const emitWithoutAck = (client: Socket, event: string, payload: unknown) => {
    client.emit(event, payload);
};

const buildDummyMessage = (type: string, content = "dummy test") => ({
    type,
    context: "dummy",
    actor: { id: "test@dummy", type: "person" },
    object: { type: "message", content },
});

describe("Parent Process Sudden Termination", () => {
    const testConfig: TestConfig = {
        sockethubLogs: [],
        isVerbose: process.env.VERBOSE === "true",
    };

    // Helper function to show recent logs on failure
    function showRecentLogs(context: string, lastNLines = 15) {
        console.log(`\n=== Recent Sockethub Logs (${context}) ===`);
        const recentLogs = testConfig.sockethubLogs.slice(-lastNLines);

        if (recentLogs.length > 0) {
            for (const log of recentLogs) {
                console.log(log.trim());
            }
        } else {
            console.log("No recent logs found");
        }
        console.log("=== End Logs ===\n");
    }

    // Helper function to mark a point in logs for debugging
    function markLogPoint(context: string) {
        testConfig.sockethubLogs.push(
            `[TEST-MARKER] ${context} - ${new Date().toISOString()}`,
        );
    }

    beforeAll(async () => {
        // Start Sockethub server in separate process
        const sockethubPath = join(
            process.cwd(),
            "packages/sockethub/bin/sockethub",
        );

        testConfig.sockethubProcess = spawn("bun", ["run", sockethubPath], {
            env: {
                ...process.env,
                REDIS_URL: config.redis.url,
                PORT: config.sockethub.port,
                NODE_ENV: "test",
                SOCKETHUB_PLATFORM_HEARTBEAT_INTERVAL_MS: "500",
                SOCKETHUB_PLATFORM_HEARTBEAT_TIMEOUT_MS: "2000",
            },
            stdio: ["pipe", "pipe", "pipe"],
        });

        // Wait for server to start
        await new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(
                    new Error(
                        "Sockethub server failed to start within timeout",
                    ),
                );
            }, config.timeouts.process);

            let serverStarted = false;

            // NOTE: Winston logs go to stdout (info/warn/error levels)
            testConfig.sockethubProcess.stdout.on("data", (data) => {
                const output = data.toString();
                testConfig.sockethubLogs.push(output);

                if (testConfig.isVerbose) {
                    console.log("Sockethub stdout:", output);
                }

                if (
                    output.includes(
                        `sockethub listening on ws://localhost:${config.sockethub.port}`,
                    ) &&
                    !serverStarted
                ) {
                    serverStarted = true;
                    clearTimeout(timeoutId);
                    console.log("✓ Sockethub server started successfully");
                    resolve();
                }

                // Check for shutdown message which indicates failure
                if (output.includes("sockethub shutdown")) {
                    clearTimeout(timeoutId);
                    reject(
                        new Error(
                            "Sockethub process shut down unexpectedly during startup",
                        ),
                    );
                }
            });

            testConfig.sockethubProcess.stderr.on("data", (data) => {
                const output = data.toString();
                testConfig.sockethubLogs.push(output);

                if (testConfig.isVerbose) {
                    console.log("Sockethub stderr:", output);
                }

                // Also check stderr for shutdown message
                if (output.includes("sockethub shutdown")) {
                    clearTimeout(timeoutId);
                    reject(
                        new Error(
                            "Sockethub process shut down unexpectedly during startup",
                        ),
                    );
                }
            });

            testConfig.sockethubProcess.on("error", (err) => {
                clearTimeout(timeoutId);
                console.log("sockethub error event: ", err);
                reject(err);
            });

            testConfig.sockethubProcess.on("exit", (code, signal) => {
                console.log("sockethub exit event: ", code);
                if (!serverStarted) {
                    clearTimeout(timeoutId);
                    reject(
                        new Error(
                            `Sockethub process exited with code ${code} and signal ${signal} before startup completed`,
                        ),
                    );
                }
            });
        });
    });

    afterAll(async () => {
        // Clean up client connection
        if (testConfig.client) {
            testConfig.client.disconnect();
            testConfig.client = undefined;
        }

        // Clean up server process (if still running)
        if (
            testConfig.sockethubProcess &&
            !testConfig.sockethubProcess.killed
        ) {
            testConfig.sockethubProcess.kill("SIGKILL");
            testConfig.sockethubProcess = undefined;
        }

        // Reset test config
        testConfig.platformChildPid = undefined;
    });

    it("should verify Redis server is reachable", async () => {
        try {
            const redisCheck = spawn(
                "nc",
                ["-z", "-v", config.redis.host, config.redis.port],
                {
                    stdio: ["ignore", "pipe", "pipe"],
                },
            );
            const checkResult = await new Promise<boolean>((resolve) => {
                let success = false;
                redisCheck.stderr.on("data", (data) => {
                    if (data.toString().includes("succeeded")) {
                        success = true;
                    }
                });
                redisCheck.on("close", () => resolve(success));
                setTimeout(() => resolve(false), config.timeouts.message);
            });

            if (!checkResult) {
                console.log(
                    `Redis server is not reachable at ${config.redis.host}:${config.redis.port}`,
                );
                console.log("Make sure to run: bun run docker:start:redis");
                throw new Error("Redis server not available - aborting test");
            }
            if (testConfig.isVerbose) {
                console.log("Redis server verified as reachable");
            }
        } catch (e) {
            console.log(
                "Could not verify Redis connectivity (nc command failed)",
            );
            throw new Error("Redis server not reachable - aborting test");
        }
    });

    it("should verify XMPP server is reachable", async () => {
        try {
            const xmppCheck = spawn(
                "nc",
                ["-z", "-v", config.prosody.host, config.prosody.port],
                {
                    stdio: ["ignore", "pipe", "pipe"],
                },
            );
            const checkResult = await new Promise<boolean>((resolve) => {
                let success = false;
                xmppCheck.stderr.on("data", (data) => {
                    if (testConfig.isVerbose) {
                        console.log("XMPP data event ", data);
                    }
                    if (data.toString().includes("succeeded")) {
                        success = true;
                    }
                });
                xmppCheck.on("close", () => resolve(success));
                setTimeout(() => resolve(false), config.timeouts.message);
            });

            if (!checkResult) {
                console.log(
                    `XMPP server (Prosody) is not reachable at ${config.prosody.host}:${config.prosody.port}`,
                );
                console.log("Make sure to run: bun run docker:start:xmpp");
                throw new Error("XMPP server not available - aborting test");
            }
            if (testConfig.isVerbose) {
                console.log("XMPP server verified as reachable");
            }
        } catch (e) {
            console.log(
                "Could not verify XMPP connectivity (nc command failed)",
            );
            throw new Error("XMPP server not reachable - aborting test");
        }
    });

    it("should connect to Sockethub", async () => {
        testConfig.client = io(config.sockethub.url, {
            path: "/sockethub",
            transports: ["websocket"],
        });

        await new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error("Failed to connect to Sockethub"));
            }, config.timeouts.connect);

            testConfig.client.on("connect", () => {
                clearTimeout(timeoutId);
                resolve();
            });

            testConfig.client.on("error", (err) => {
                clearTimeout(timeoutId);
                reject(err);
            });
        });
    });

    it("should send XMPP credentials and establish connection", async () => {
        // Ensure we have a client connection from previous test
        if (!testConfig.client) {
            throw new Error("No client connection - run previous test first");
        }
        const actorId = utils.createXmppJid();
        const credentialsMessage = {
            type: "credentials",
            context: "xmpp",
            actor: {
                id: actorId,
                type: "person",
            },
            object: {
                type: "credentials",
                password: config.prosody.testUser.password,
                resource: "SockethubTest1",
                userAddress: `${config.prosody.testUser.username}@${config.prosody.host}`,
                server: `xmpp://${config.prosody.host}:${config.prosody.port}`,
            },
        };

        // Mark the point where we're about to send credentials
        markLogPoint("Sending XMPP credentials");

        // Send credentials and wait for confirmation
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Credentials timeout"));
            }, config.timeouts.process);

            console.log("→ Sending credentials message to sockethub");
            testConfig.client.emit(
                "credentials",
                credentialsMessage,
                (response) => {
                    clearTimeout(timeout);
                    if (testConfig.isVerbose) {
                        console.log(
                            "Credentials response:",
                            JSON.stringify(response, null, 2),
                        );
                    }
                    resolve();
                },
            );
        });

        // Create a persistent XMPP connection
        const connectMessage = {
            type: "connect",
            context: "xmpp",
            actor: {
                id: actorId,
                type: "person",
            },
        };

        // Mark the point where we're about to send the connect message
        markLogPoint("Sending XMPP connect message");

        // Send connect message and wait for response
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("XMPP connect timeout"));
            }, config.timeouts.connect);

            console.log("→ Sending XMPP connect message to sockethub");
            testConfig.client.emit("message", connectMessage, (response) => {
                clearTimeout(timeout);
                if (testConfig.isVerbose) {
                    console.log(
                        "XMPP connect response:",
                        JSON.stringify(response, null, 2),
                    );
                }
                if (response.error) {
                    console.log("XMPP connection failed:", response.error);
                    showRecentLogs("XMPP Connection", 20);
                    reject(new Error(response.error));
                } else {
                    console.log("✓ XMPP connection established");
                    resolve();
                }
            });
        });
    });

    it("should find XMPP platform child processes", async () => {
        // Ensure we have established XMPP connection from previous test
        if (!testConfig.sockethubProcess) {
            throw new Error("No Sockethub process - run previous tests first");
        }
        // Get all child processes that should include our XMPP platform
        const childPids = await waitForPlatformChildProcesses(
            { platformName: "xmpp" },
            config.timeouts.process,
        );

        if (testConfig.isVerbose) {
            console.log(
                `Found ${childPids.length} child processes:`,
                childPids,
            );
        }

        if (childPids.length === 0) {
            console.log("❌ No XMPP platform child processes found");
            showRecentLogs("Child Process Detection", 20);

            if (testConfig.isVerbose) {
                console.log("Checking all processes for debugging:");
                const allProcesses = await new Promise<string>((resolve) => {
                    const ps = spawn("ps", ["-eo", "pid,ppid,command"], {
                        stdio: ["ignore", "pipe", "pipe"],
                    });
                    let output = "";
                    ps.stdout.on("data", (data) => {
                        output += data.toString();
                    });
                    ps.on("close", () => resolve(output));
                });
                console.log(
                    "All processes containing 'platform' or 'sockethub':",
                );
                for (const line of allProcesses.split("\n")) {
                    if (
                        line.includes("platform") ||
                        line.includes("sockethub")
                    ) {
                        console.log(line);
                    }
                }
            }
        } else {
            console.log(
                `✓ Found ${childPids.length} XMPP platform process(es)`,
            );
        }

        expect(childPids.length).toBeGreaterThan(0);
        testConfig.platformChildPid = childPids[0]; // Store first child for next test
    });

    it("should verify child process is running before termination", () => {
        const isRunning = isProcessRunning(testConfig.platformChildPid);
        if (!isRunning) {
            console.log(
                `❌ Platform child process ${testConfig.platformChildPid} is not running`,
            );
            showRecentLogs("Process Verification", 10);
        } else {
            console.log(
                `✓ Platform child process ${testConfig.platformChildPid} is running`,
            );
        }
        expect(isRunning).toBe(true);
    });

    describe("Dummy platform crash detection", () => {
        const runWithLogs = async <T>(
            context: string,
            fn: () => Promise<T>,
        ) => {
            try {
                return await fn();
            } catch (err) {
                showRecentLogs(context, 60);
                throw err;
            }
        };

        const ensureDummyPlatform = async () => {
            if (!testConfig.client) {
                throw new Error(
                    "No client connection - run previous tests first",
                );
            }
            emitWithoutAck(
                testConfig.client,
                "message",
                buildDummyMessage("echo"),
            );
            const childPids = await waitForPlatformChildProcesses(
                { platformName: "dummy", excludeNames: ["xmpp"] },
                config.timeouts.process,
            );
            expect(childPids.length).toBeGreaterThan(0);
            testConfig.dummyChildPid = childPids[0];
        };

        const waitForDummyRestart = async (
            oldPid: number,
            timeoutMs: number,
        ) => {
            const start = Date.now();
            while (Date.now() - start < timeoutMs) {
                if (
                    testConfig.sockethubProcess?.exitCode !== null &&
                    testConfig.sockethubProcess?.exitCode !== undefined
                ) {
                    throw new Error(
                        `Sockethub exited with code ${testConfig.sockethubProcess.exitCode}`,
                    );
                }
                emitWithoutAck(
                    testConfig.client as Socket,
                    "message",
                    buildDummyMessage("echo"),
                );
                const childPids = await waitForPlatformChildProcesses(
                    { platformName: "dummy", excludeNames: ["xmpp"] },
                    500,
                );
                const nextPid = childPids.find((pid) => pid !== oldPid);
                if (nextPid) {
                    testConfig.dummyChildPid = nextPid;
                    return nextPid;
                }
                await new Promise((resolve) => setTimeout(resolve, 200));
            }
            throw new Error("Timed out waiting for dummy platform restart");
        };

        it("should start dummy platform process on first message", async () =>
            runWithLogs("Dummy platform start", async () => {
                await ensureDummyPlatform();
                expect(isProcessRunning(testConfig.dummyChildPid)).toBe(true);
            }));

        it(
            "should recover from process.exit(1)",
            async () =>
                runWithLogs("Dummy crash: exit1", async () => {
                    if (!testConfig.dummyChildPid) {
                        await ensureDummyPlatform();
                    }
                    const oldPid = testConfig.dummyChildPid as number;
                    testConfig.client?.emit(
                        "message",
                        buildDummyMessage("exit1"),
                    );

                    const exited = await waitForProcessExit(
                        oldPid,
                        config.timeouts.process + config.timeouts.cleanup,
                    );
                    expect(exited).toBe(true);

                    const newPid = await waitForDummyRestart(
                        oldPid,
                        config.timeouts.process,
                    );
                    expect(newPid).not.toEqual(oldPid);
                }),
            config.timeouts.process + config.timeouts.cleanup + 5000,
        );

        it(
            "should recover from uncaught TypeError",
            async () =>
                runWithLogs("Dummy crash: TypeError", async () => {
                    if (!testConfig.dummyChildPid) {
                        await ensureDummyPlatform();
                    }
                    const oldPid = testConfig.dummyChildPid as number;
                    testConfig.client?.emit(
                        "message",
                        buildDummyMessage("throwTypeError"),
                    );

                    const exited = await waitForProcessExit(
                        oldPid,
                        config.timeouts.process + config.timeouts.cleanup,
                    );
                    expect(exited).toBe(true);

                    const newPid = await waitForDummyRestart(
                        oldPid,
                        config.timeouts.process,
                    );
                    expect(newPid).not.toEqual(oldPid);
                }),
            config.timeouts.process + config.timeouts.cleanup + 5000,
        );

        it(
            "should recover from SIGTERM",
            async () =>
                runWithLogs("Dummy crash: SIGTERM", async () => {
                    if (!testConfig.dummyChildPid) {
                        await ensureDummyPlatform();
                    }
                    const oldPid = testConfig.dummyChildPid as number;
                    testConfig.client?.emit(
                        "message",
                        buildDummyMessage("sigterm"),
                    );

                    const exited = await waitForProcessExit(
                        oldPid,
                        config.timeouts.process + config.timeouts.cleanup,
                    );
                    expect(exited).toBe(true);

                    const newPid = await waitForDummyRestart(
                        oldPid,
                        config.timeouts.process,
                    );
                    expect(newPid).not.toEqual(oldPid);
                }),
            config.timeouts.process + config.timeouts.cleanup + 5000,
        );

        it(
            "should recover from heartbeat timeout (hang)",
            async () =>
                runWithLogs("Dummy crash: heartbeat hang", async () => {
                    if (!testConfig.dummyChildPid) {
                        await ensureDummyPlatform();
                    }
                    const oldPid = testConfig.dummyChildPid as number;
                    testConfig.client?.emit(
                        "message",
                        buildDummyMessage("hang"),
                    );

                    const exited = await waitForProcessExit(
                        oldPid,
                        config.timeouts.process +
                            config.timeouts.cleanup +
                            3000,
                    );
                    expect(exited).toBe(true);

                    const newPid = await waitForDummyRestart(
                        oldPid,
                        config.timeouts.process + 2000,
                    );
                    expect(newPid).not.toEqual(oldPid);
                }),
            config.timeouts.process + config.timeouts.cleanup + 8000,
        );
    });

    it("should terminate child process when parent dies suddenly", async () => {
        // Kill parent process suddenly (SIGKILL - no cleanup possible)
        testConfig.sockethubProcess.kill("SIGKILL");

        // Wait for OS to clean up orphaned processes
        await new Promise((resolve) =>
            setTimeout(resolve, config.timeouts.cleanup),
        );

        // Verify the child process is no longer running
        const childStillRunning = isProcessRunning(testConfig.platformChildPid);
        expect(childStillRunning).toBe(false);

        // Clean up reference since parent is already dead
        testConfig.sockethubProcess = undefined;
    });
});
