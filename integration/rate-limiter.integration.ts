import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { createConnection } from "node:net";
import { join } from "node:path";
import { type Socket, io } from "socket.io-client";

import config from "./config.js";

describe("Rate Limiter Integration Tests", () => {
    let client: Socket;
    const socketUrl = config.sockethub.url;
    const socketPath = "/sockethub";
    let sockethubProcess: ChildProcess | undefined;
    let usingExternalSockethub = false;

    async function isPortOpen(host: string, port: number) {
        return new Promise<boolean>((resolve) => {
            const socket = createConnection({ host, port });
            const done = (result: boolean) => {
                socket.removeAllListeners();
                socket.end();
                socket.destroy();
                resolve(result);
            };
            socket.once("connect", () => done(true));
            socket.once("error", () => done(false));
            socket.setTimeout(1000, () => done(false));
        });
    }

    async function stopSockethubProcess(process: ChildProcess) {
        const waitForExit = (signal: NodeJS.Signals, timeoutMs: number) =>
            new Promise<boolean>((resolve) => {
                if (process.exitCode !== null || process.signalCode !== null) {
                    resolve(true);
                    return;
                }

                const onExit = () => {
                    clearTimeout(timeoutId);
                    resolve(true);
                };

                const timeoutId = setTimeout(() => {
                    process.off("exit", onExit);
                    resolve(false);
                }, timeoutMs);

                process.once("exit", onExit);
                process.kill(signal);
            });

        const exitedAfterTerm = await waitForExit("SIGTERM", 3000);
        if (exitedAfterTerm) {
            return;
        }

        await waitForExit("SIGKILL", 1000);
    }

    beforeAll(async () => {
        const port = Number.parseInt(config.sockethub.port, 10);
        usingExternalSockethub = await isPortOpen("localhost", port);

        if (!usingExternalSockethub) {
            const sockethubPath = join(
                process.cwd(),
                "packages/sockethub/bin/sockethub",
            );

            sockethubProcess = spawn("bun", ["run", sockethubPath], {
                env: {
                    ...process.env,
                    REDIS_URL: config.redis.url,
                    PORT: config.sockethub.port,
                    NODE_ENV: "test",
                },
                stdio: ["pipe", "pipe", "pipe"],
            });

            await new Promise<void>((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(
                        new Error(
                            "Sockethub server failed to start within timeout",
                        ),
                    );
                }, 15000);

                let serverStarted = false;

                sockethubProcess?.stdout?.on("data", (data) => {
                    const output = data.toString();
                    if (
                        output.includes(
                            `sockethub listening on ws://localhost:${config.sockethub.port}`,
                        ) &&
                        !serverStarted
                    ) {
                        serverStarted = true;
                        clearTimeout(timeoutId);
                        resolve();
                    }
                });

                sockethubProcess?.on("error", (err) => {
                    clearTimeout(timeoutId);
                    reject(err);
                });

                sockethubProcess?.on("exit", (code, signal) => {
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
        }
    });

    afterAll(async () => {
        if (client?.connected) {
            client.disconnect();
        }
        if (sockethubProcess && !sockethubProcess.killed) {
            await stopSockethubProcess(sockethubProcess);
            sockethubProcess = undefined;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
    });

    test("should emit ActivityStreams error when rate limit exceeded", async () => {
        return new Promise<void>((resolve, reject) => {
            client = io(socketUrl, { path: socketPath });

            let errorReceived = false;

            client.on("connect", () => {
                client.on("error", (errorMsg: unknown) => {
                    if (!errorReceived) {
                        errorReceived = true;

                        try {
                            expect(errorMsg).toBeDefined();
                            expect(errorMsg.type).toBe("Error");
                            expect(errorMsg.context).toBe("error");
                            expect(errorMsg.actor).toBeDefined();
                            expect(errorMsg.actor.type).toBe("Application");
                            expect(errorMsg.actor.name).toBe(
                                "sockethub-server",
                            );
                            expect(errorMsg.summary).toBe(
                                "rate limit exceeded, temporarily blocked",
                            );

                            client.disconnect();
                            resolve();
                        } catch (err) {
                            client.disconnect();
                            reject(err);
                        }
                    }
                });

                for (let i = 0; i < 110; i++) {
                    client.emit("message", {
                        type: "echo",
                        actor: "test@dummy",
                        context: "dummy",
                        object: {
                            type: "message",
                            content: `test message ${i}`,
                        },
                    });
                }
            });

            client.on("connect_error", (err) => {
                reject(
                    new Error(
                        `Connection failed: ${err.message}. Is Sockethub running on ${socketUrl}?`,
                    ),
                );
            });

            setTimeout(() => {
                if (!errorReceived) {
                    client.disconnect();
                    reject(
                        new Error(
                            "Rate limit error not received within timeout",
                        ),
                    );
                }
            }, 10000);
        });
    });

    test("should block client for configured duration after rate limit exceeded", async () => {
        return new Promise<void>((resolve, reject) => {
            client = io(socketUrl, { path: socketPath });

            let errorCount = 0;
            const startTime = Date.now();

            client.on("connect", () => {
                client.on("error", (errorMsg: unknown) => {
                    if (
                        errorMsg.summary ===
                        "rate limit exceeded, temporarily blocked"
                    ) {
                        errorCount++;

                        if (errorCount === 1) {
                            expect(errorMsg.type).toBe("Error");
                            expect(errorMsg.context).toBe("error");

                            const elapsed = Date.now() - startTime;
                            expect(elapsed).toBeLessThan(2000);
                            client.disconnect();
                            resolve();
                        }
                    }
                });

                for (let i = 0; i < 110; i++) {
                    client.emit("message", {
                        type: "echo",
                        actor: { id: "test2@dummy", type: "person" },
                        context: "dummy",
                        object: { type: "message", content: `msg ${i}` },
                    });
                }
            });

            client.on("connect_error", (err) => {
                reject(
                    new Error(
                        `Connection failed: ${err.message}. Is Sockethub running?`,
                    ),
                );
            });

            setTimeout(() => {
                if (errorCount < 1) {
                    client.disconnect();
                    reject(
                        new Error(
                            `Expected rate limit error, got ${errorCount}`,
                        ),
                    );
                }
            }, 10000);
        });
    }, 15000);

    test("should automatically unblock client after block duration expires", async () => {
        return new Promise<void>((resolve, reject) => {
            client = io(socketUrl, { path: socketPath });

            let blocked = false;
            let unblocked = false;

            client.on("connect", () => {
                client.on("error", (errorMsg: unknown) => {
                    if (
                        errorMsg.summary ===
                        "rate limit exceeded, temporarily blocked"
                    ) {
                        blocked = true;
                    }
                });

                for (let i = 0; i < 110; i++) {
                    client.emit("message", {
                        type: "echo",
                        actor: { id: "test3@dummy", type: "person" },
                        context: "dummy",
                        object: { type: "message", content: `msg ${i}` },
                    });
                }

                setTimeout(() => {
                    client.emit(
                        "message",
                        {
                            type: "echo",
                            actor: { id: "test3@dummy", type: "person" },
                            context: "dummy",
                            object: {
                                type: "message",
                                content: "unblock test",
                            },
                        },
                        (response: unknown) => {
                            if (!response?.error) {
                                unblocked = true;
                                expect(blocked).toBe(true);
                                expect(unblocked).toBe(true);
                                client.disconnect();
                                resolve();
                            } else {
                                client.disconnect();
                                reject(
                                    new Error(
                                        `Client still blocked after duration: ${response.error}`,
                                    ),
                                );
                            }
                        },
                    );
                }, 5500);
            });

            client.on("connect_error", (err) => {
                reject(
                    new Error(
                        `Connection failed: ${err.message}. Is Sockethub running?`,
                    ),
                );
            });

            setTimeout(() => {
                if (!unblocked) {
                    client.disconnect();
                    reject(new Error("Client was not unblocked after timeout"));
                }
            }, 12000);
        });
    }, 15000);

    test("should handle multiple clients independently", async () => {
        return new Promise<void>((resolve, reject) => {
            const client1 = io(socketUrl, { path: socketPath });
            const client2 = io(socketUrl, { path: socketPath });

            let client1Blocked = false;
            let client2Success = false;
            let connectCount = 0;

            const checkComplete = () => {
                if (client1Blocked && client2Success) {
                    client1.disconnect();
                    client2.disconnect();
                    resolve();
                }
            };

            const onConnect = () => {
                connectCount++;
                if (connectCount === 2) {
                    client1.on("error", (errorMsg: unknown) => {
                        if (
                            errorMsg.summary ===
                            "rate limit exceeded, temporarily blocked"
                        ) {
                            client1Blocked = true;
                            checkComplete();
                        }
                    });

                    for (let i = 0; i < 110; i++) {
                        client1.emit("message", {
                            type: "echo",
                            actor: { id: "test4@dummy", type: "person" },
                            context: "dummy",
                            object: {
                                type: "message",
                                content: `client1 msg ${i}`,
                            },
                        });
                    }

                    setTimeout(() => {
                        client2.emit(
                            "message",
                            {
                                type: "echo",
                                actor: { id: "test5@dummy", type: "person" },
                                context: "dummy",
                                object: {
                                    type: "message",
                                    content: "client2 test",
                                },
                            },
                            (response: unknown) => {
                                if (!response?.error) {
                                    client2Success = true;
                                    checkComplete();
                                } else {
                                    client1.disconnect();
                                    client2.disconnect();
                                    reject(
                                        new Error(
                                            `Client2 failed unexpectedly: ${response.error}`,
                                        ),
                                    );
                                }
                            },
                        );
                    }, 100);
                }
            };

            client1.on("connect", onConnect);
            client2.on("connect", onConnect);

            client1.on("connect_error", (err) => {
                reject(
                    new Error(
                        `Client1 connection failed: ${err.message}. Is Sockethub running?`,
                    ),
                );
            });

            client2.on("connect_error", (err) => {
                reject(
                    new Error(
                        `Client2 connection failed: ${err.message}. Is Sockethub running?`,
                    ),
                );
            });

            setTimeout(() => {
                if (!client1Blocked || !client2Success) {
                    client1.disconnect();
                    client2.disconnect();
                    reject(
                        new Error(
                            `Multi-client test incomplete: client1Blocked=${client1Blocked}, client2Success=${client2Success}`,
                        ),
                    );
                }
            }, 10000);
        });
    }, 15000);
});
