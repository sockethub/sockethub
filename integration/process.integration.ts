import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { join } from "node:path";
import { type Socket, io } from "socket.io-client";

const REDIS_HOST = "localhost";
const REDIS_PORT = "16379";
const REDIS_URL = `redis://${REDIS_HOST}:${REDIS_PORT}`;
const SOCKETHUB_PORT = 10550; // Sockethub default port
const XMPP_PORT = "8222";

interface TestConfig {
    sockethubProcess?: ChildProcess;
    client?: Socket;
    platformChildPid?: number;
}

describe("Parent Process Sudden Termination", () => {
    const testConfig: TestConfig = {};
    const timeout = 20000; // 20 second timeout for process operations

    beforeAll(async () => {
        // Start Sockethub server in separate process
        const sockethubPath = join(
            process.cwd(),
            "packages/sockethub/bin/sockethub",
        );

        testConfig.sockethubProcess = spawn("bun", ["run", sockethubPath], {
            env: {
                ...process.env,
                REDIS_URL,
                PORT: SOCKETHUB_PORT.toString(),
                NODE_ENV: "test",
                DEBUG: "sockethub*",
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
            }, timeout);

            let serverStarted = false;

            // NOTE: Sockethub debug messages go to stderr (likely due to debug module behavior)
            testConfig.sockethubProcess.stderr.on("data", (data) => {
                const output = data.toString();
                console.log("Sockethub stderr:", output);
                
                if (output.includes("sockethub listening") && !serverStarted) {
                    serverStarted = true;
                    clearTimeout(timeoutId);
                    resolve();
                }
                
                // Check for shutdown message which indicates failure
                if (output.includes("sockethub shutdown")) {
                    clearTimeout(timeoutId);
                    reject(new Error("Sockethub process shut down unexpectedly during startup"));
                }
            });

            testConfig.sockethubProcess.stdout.on("data", (data) => {
                const output = data.toString();
                console.log("Sockethub stdout:", output);
                
                // Also check stdout for shutdown message
                if (output.includes("sockethub shutdown")) {
                    clearTimeout(timeoutId);
                    reject(new Error("Sockethub process shut down unexpectedly during startup"));
                }
            });

            testConfig.sockethubProcess.on("error", (err) => {
                clearTimeout(timeoutId);
                reject(err);
            });

            testConfig.sockethubProcess.on("exit", (code, signal) => {
                if (!serverStarted) {
                    clearTimeout(timeoutId);
                    reject(new Error(`Sockethub process exited with code ${code} and signal ${signal} before startup completed`));
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
            const redisCheck = spawn("nc", ["-z", "-v", "localhost", REDIS_PORT], {
                stdio: ["ignore", "pipe", "pipe"],
            });
            const checkResult = await new Promise<boolean>((resolve) => {
                let success = false;
                redisCheck.stderr.on("data", (data) => {
                    if (data.toString().includes("succeeded")) {
                        success = true;
                    }
                });
                redisCheck.on("close", () => resolve(success));
                setTimeout(() => resolve(false), 2000);
            });

            if (!checkResult) {
                console.log(
                    `Redis server is not reachable at localhost:${REDIS_PORT}`,
                );
                console.log("Make sure to run: bun run docker:start:redis");
                throw new Error("Redis server not available - aborting test");
            }
            console.log("Redis server verified as reachable");
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
                ["-z", "-v", "localhost", XMPP_PORT],
                {
                    stdio: ["ignore", "pipe", "pipe"],
                },
            );
            const checkResult = await new Promise<boolean>((resolve) => {
                let success = false;
                xmppCheck.stderr.on("data", (data) => {
                    if (data.toString().includes("succeeded")) {
                        success = true;
                    }
                });
                xmppCheck.on("close", () => resolve(success));
                setTimeout(() => resolve(false), 2000);
            });

            if (!checkResult) {
                console.log(
                    `XMPP server (Prosody) is not reachable at localhost:${XMPP_PORT}`,
                );
                console.log("Make sure to run: bun run docker:start:xmpp");
                throw new Error("XMPP server not available - aborting test");
            }
            console.log("XMPP server verified as reachable");
        } catch (e) {
            console.log(
                "Could not verify XMPP connectivity (nc command failed)",
            );
            throw new Error("XMPP server not reachable - aborting test");
        }
    });

    it("should connect to Sockethub via Socket.IO", async () => {
        testConfig.client = io(`http://localhost:${SOCKETHUB_PORT}`, {
            path: "/sockethub",
            transports: ["websocket"],
        });

        await new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error("Failed to connect to Sockethub"));
            }, 5000);

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
        const credentialsMessage = {
            type: "credentials",
            context: "xmpp",
            actor: {
                id: "jimmy@prosody/SockethubTest",
                type: "person",
            },
            object: {
                type: "credentials",
                password: "passw0rd",
                resource: "SockethubTest",
                port: XMPP_PORT,
                userAddress: "jimmy@prosody",
            },
        };

        // Send credentials and wait for confirmation
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Credentials timeout"));
            }, 5000);

            testConfig.client.emit(
                "message",
                credentialsMessage,
                (response) => {
                    clearTimeout(timeout);
                    console.log(
                        "Credentials response:",
                        JSON.stringify(response, null, 2),
                    );
                    resolve();
                },
            );
        });

        // Create a persistent XMPP connection
        const connectMessage = {
            type: "connect",
            context: "xmpp",
            actor: {
                id: "jimmy@prosody/SockethubTest",
                type: "person",
            },
        };

        // Send connect message and wait for response
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("XMPP connect timeout"));
            }, 5000);

            testConfig.client.emit("message", connectMessage, (response) => {
                clearTimeout(timeout);
                console.log(
                    "XMPP connect response:",
                    JSON.stringify(response, null, 2),
                );
                resolve();
            });
        });
    });

    it("should find XMPP platform child processes", async () => {
        // Ensure we have established XMPP connection from previous test
        if (!testConfig.sockethubProcess) {
            throw new Error("No Sockethub process - run previous tests first");
        }
        // Look for child processes of the Sockethub parent
        const findChildProcesses = async (): Promise<number[]> => {
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
                        // Skip header
                        const parts = line.trim().split(/\s+/);
                        if (parts.length >= 3) {
                            const pid = Number.parseInt(parts[0]);
                            const ppid = Number.parseInt(parts[1]);
                            const command = parts.slice(2).join(" ");

                            // Look for XMPP platform processes (may be daemonized under PID 1)
                            if (
                                command.includes("platform.js") &&
                                command.includes("xmpp")
                            ) {
                                childPids.push(pid);
                            }
                        }
                    }
                    resolve(childPids);
                });

                ps.on("error", () => {
                    resolve([]); // Return empty array if ps fails
                });
            });
        };

        // Get all child processes that should include our XMPP platform
        const childPids = await findChildProcesses();
        console.log(`Found ${childPids.length} child processes:`, childPids);

        if (childPids.length === 0) {
            console.log("No child processes found. Let's check all processes:");
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
            console.log("All processes containing 'platform' or 'sockethub':");
            for (const line of allProcesses.split("\n")) {
                if (line.includes("platform") || line.includes("sockethub")) {
                    console.log(line);
                }
            }
        }

        expect(childPids.length).toBeGreaterThan(0);
        testConfig.platformChildPid = childPids[0]; // Store first child for next test
    });

    it("should verify child process is running before termination", () => {
        const isProcessRunning = (pid: number) => {
            try {
                process.kill(pid, 0); // Signal 0 just checks if process exists
                return true;
            } catch {
                return false;
            }
        };

        expect(isProcessRunning(testConfig.platformChildPid)).toBe(true);
    });

    it("should terminate child process when parent dies suddenly", async () => {
        const isProcessRunning = (pid: number) => {
            try {
                process.kill(pid, 0); // Signal 0 just checks if process exists
                return true;
            } catch {
                return false;
            }
        };

        // Kill parent process suddenly (SIGKILL - no cleanup possible)
        testConfig.sockethubProcess.kill("SIGKILL");

        // Wait for OS to clean up orphaned processes
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Verify the child process is no longer running
        const childStillRunning = isProcessRunning(testConfig.platformChildPid);
        expect(childStillRunning).toBe(false);

        // Clean up reference since parent is already dead
        testConfig.sockethubProcess = undefined;
    });
});
