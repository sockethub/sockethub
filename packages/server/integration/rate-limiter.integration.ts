import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type Socket, io } from "socket.io-client";

describe("Rate Limiter Integration Tests", () => {
    let client: Socket;
    const socketUrl = "http://localhost:10550";
    const socketPath = "/sockethub";

    beforeAll(async () => {
        // Note: These tests expect Sockethub to be running externally
        // Run with: bun run packages/sockethub/bin/sockethub
        // Give server time to initialize if just started
        await new Promise((resolve) => setTimeout(resolve, 500));
    });

    afterAll(async () => {
        if (client?.connected) {
            client.disconnect();
        }
        // Give time for cleanup
        await new Promise((resolve) => setTimeout(resolve, 200));
    });

    test("should emit ActivityStreams error when rate limit exceeded", async () => {
        return new Promise<void>((resolve, reject) => {
            client = io(socketUrl, { path: socketPath });

            let errorReceived = false;

            client.on("connect", () => {
                // Listen for error event
                client.on("error", (errorMsg: unknown) => {
                    if (!errorReceived) {
                        errorReceived = true;

                        try {
                            // Verify ActivityStreams format
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

                // Send rapid events to trigger rate limit
                // Default config: 100 requests per 1000ms
                // Send 110 messages rapidly to exceed limit
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

            // Timeout after 10 seconds
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
                            // First error received - verify it's the rate limit error
                            expect(errorMsg.type).toBe("Error");
                            expect(errorMsg.context).toBe("error");

                            // Once we get the first error, we're done - client is blocked
                            const elapsed = Date.now() - startTime;
                            // Should be quick (within first second)
                            expect(elapsed).toBeLessThan(2000);
                            client.disconnect();
                            resolve();
                        }
                    }
                });

                // Trigger rate limit
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

                // Trigger rate limit
                for (let i = 0; i < 110; i++) {
                    client.emit("message", {
                        type: "echo",
                        actor: { id: "test3@dummy", type: "person" },
                        context: "dummy",
                        object: { type: "message", content: `msg ${i}` },
                    });
                }

                // Wait for block duration (5000ms default) + buffer
                setTimeout(() => {
                    // Send a test message that should succeed
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
                }, 5500); // Wait 5.5 seconds (block duration + buffer)
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
            }, 12000); // Total timeout: 12 seconds
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
                    // Both clients connected, start test
                    // Listen for errors on client1
                    client1.on("error", (errorMsg: unknown) => {
                        if (
                            errorMsg.summary ===
                            "rate limit exceeded, temporarily blocked"
                        ) {
                            client1Blocked = true;
                            checkComplete();
                        }
                    });

                    // Trigger rate limit on client1
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

                    // Client2 should still work normally
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
