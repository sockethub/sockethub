import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { io, type Socket } from "socket.io-client";

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

    beforeEach(async () => {
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

            // NOTE: Sockethub debug messages go to stderr (likely due to debug module behavior)
            testConfig.sockethubProcess.stderr.on("data", (data) => {
                const output = data.toString();
                if (output.includes("sockethub listening")) {
                    clearTimeout(timeoutId);
                    resolve();
                }
            });

            testConfig.sockethubProcess.stdout.on("data", (data) => {
                console.log("Sockethub stdout:", data.toString());
            });

            testConfig.sockethubProcess.on("error", (err) => {
                clearTimeout(timeoutId);
                reject(err);
            });
        });
    });

    afterEach(async () => {
        // Clean up client connection
        if (testConfig.client) {
            testConfig.client.disconnect();
            testConfig.client = undefined;
        }

        // Clean up server process
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

    it(
        "should terminate XMPP child process when parent dies suddenly",
        async () => {
            // Step 0: Verify XMPP (Prosody) is reachable
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
                    throw new Error(
                        "XMPP server not available - aborting test",
                    );
                }
                console.log("XMPP server verified as reachable");
            } catch (e) {
                console.log(
                    "Could not verify XMPP connectivity (nc command failed)",
                );
                throw new Error("XMPP server not reachable - aborting test");
            }

            // Step 1: Connect to Sockethub
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

            // Step 2: Set up XMPP credentials for the Docker Prosody service
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

            // Send credentials
            testConfig.client.emit("message", credentialsMessage);

            // Step 3: Create a persistent XMPP connection
            const connectMessage = {
                type: "connect",
                context: "xmpp",
                actor: {
                    id: "jimmy@prosody/SockethubTest",
                    type: "person",
                },
            };

            // Listen for responses to capture XMPP child process creation
            let xmppConnectionAttempted = false;
            testConfig.client.on("message", (msg) => {
                console.log("Received message:", JSON.stringify(msg, null, 2));
                if (
                    msg.context === "xmpp" &&
                    (msg.type === "connect" || msg.type === "error")
                ) {
                    // XMPP platform process should be running now (even if connection fails)
                    xmppConnectionAttempted = true;
                }
            });

            testConfig.client.emit("message", connectMessage);

            // Wait for XMPP connection attempt (may fail due to network but child process should be created)
            await new Promise<void>((resolve) => {
                const checkInterval = setInterval(() => {
                    if (xmppConnectionAttempted) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);

                setTimeout(() => {
                    clearInterval(checkInterval);
                    resolve(); // Continue even if no explicit confirmation - process should still be created
                }, 5000);
            });

            // Step 4: Find the XMPP child process PID
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

                                // Look for child processes that are node processes with platform.js
                                if (
                                    ppid === testConfig.sockethubProcess.pid &&
                                    command.includes("platform.js")
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
            console.log(
                `Found ${childPids.length} child processes:`,
                childPids,
            );

            if (childPids.length === 0) {
                console.log(
                    "No child processes found. Let's check all processes:",
                );
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
                allProcesses.split("\n").forEach((line) => {
                    if (
                        line.includes("platform") ||
                        line.includes("sockethub")
                    ) {
                        console.log(line);
                    }
                });
            }

            expect(childPids.length).toBeGreaterThan(0);

            testConfig.platformChildPid = childPids[0]; // Assume first child is our platform

            // Step 5: Verify child process is running
            const isProcessRunning = (pid: number) => {
                try {
                    process.kill(pid, 0); // Signal 0 just checks if process exists
                    return true;
                } catch {
                    return false;
                }
            };

            expect(isProcessRunning(testConfig.platformChildPid)).toBe(true);

            // Step 6: Kill parent process suddenly (SIGKILL - no cleanup possible)
            testConfig.sockethubProcess.kill("SIGKILL");

            // Step 7: Wait and verify child process is no longer running
            // Give some time for the OS to clean up orphaned processes
            await new Promise((resolve) => setTimeout(resolve, 3000));

            // Verify the child process is no longer running
            const childStillRunning = isProcessRunning(
                testConfig.platformChildPid,
            );
            expect(childStillRunning).toBe(false);

            // Clean up reference since parent is already dead
            testConfig.sockethubProcess = undefined;
        },
        timeout,
    );
});
