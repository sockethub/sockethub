import { expect } from "@esm-bundle/chai";
import "./../packages/server/res/sockethub-client.js";
import "./../packages/server/res/socket.io.js";

const SH_PORT = 10550;
const TEST_ROOM = "testroom@prosody";
const CLIENT_COUNT = 10;

mocha.bail(true);
mocha.timeout("120s");

describe(`Multi-Client XMPP Integration Tests at port ${SH_PORT}`, () => {
    let clients = [];
    const messageLog = [];
    const connectionLog = [];

    // Helper function to create a client with unique credentials
    function createClient(userId) {
        const actorId = `user${userId}@prosody/SockethubTest${userId}`;
        const actorObject = {
            id: actorId,
            type: "person",
            name: `Test User ${userId}`,
        };

        const socket = io(`http://localhost:${SH_PORT}/`, {
            path: "/sockethub",
        });
        const sc = new SockethubClient(socket);

        // Track all incoming messages for verification
        sc.socket.on("message", (msg) => {
            messageLog.push({
                clientId: userId,
                timestamp: Date.now(),
                message: msg,
            });
        });

        return {
            id: userId,
            actorId,
            actorObject,
            socket: sc.socket,
            client: sc,
            connected: false,
            joinedRoom: false,
        };
    }

    // Helper function to wait for a condition with timeout
    function waitFor(condition, timeout = 5000, interval = 100) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const check = () => {
                if (condition()) {
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    reject(
                        new Error(
                            `Timeout waiting for condition after ${timeout}ms`,
                        ),
                    );
                } else {
                    setTimeout(check, interval);
                }
            };
            check();
        });
    }

    before(() => {
        // Create all clients
        for (let i = 1; i <= CLIENT_COUNT; i++) {
            clients.push(createClient(i));
        }
    });

    after(() => {
        // Cleanup all clients
        for (const client of clients) {
            if (client.socket.connected) {
                client.socket.disconnect();
            }
        }
        clients = [];
    });

    beforeEach(() => {
        messageLog.length = 0;
        connectionLog.length = 0;
    });

    describe("Concurrent Client Connections", () => {
        it("all clients can set credentials simultaneously", async () => {
            const credentialPromises = clients.map((client) => {
                return new Promise((resolve, reject) => {
                    client.socket.emit(
                        "credentials",
                        {
                            actor: {
                                id: client.actorId,
                                type: "person",
                            },
                            context: "xmpp",
                            type: "credentials",
                            object: {
                                type: "credentials",
                                password: "passw0rd",
                                resource: `SockethubTest${client.id}`,
                                userAddress: `user${client.id}@prosody`,
                            },
                        },
                        (response) => {
                            if (response?.error) {
                                reject(
                                    new Error(
                                        `Client ${client.id} credentials failed: ${response.error}`,
                                    ),
                                );
                            } else {
                                resolve();
                            }
                        },
                    );
                });
            });

            await Promise.all(credentialPromises);
        });

        it("all clients can connect simultaneously", async () => {
            const connectPromises = clients.map((client) => {
                return new Promise((resolve, reject) => {
                    // Create activity object first
                    client.client.ActivityStreams.Object.create(
                        client.actorObject,
                    );

                    client.socket.emit(
                        "message",
                        {
                            type: "connect",
                            actor: client.actorId,
                            context: "xmpp",
                        },
                        (msg) => {
                            if (msg?.error) {
                                reject(
                                    new Error(
                                        `Client ${client.id} connection failed: ${msg.error}`,
                                    ),
                                );
                            } else {
                                client.connected = true;
                                connectionLog.push({
                                    clientId: client.id,
                                    timestamp: Date.now(),
                                    action: "connected",
                                });
                                resolve(msg);
                            }
                        },
                    );
                });
            });

            const results = await Promise.all(connectPromises);

            // Verify all clients connected successfully
            expect(results).to.have.length(CLIENT_COUNT);
            expect(clients.filter((c) => c.connected)).to.have.length(
                CLIENT_COUNT,
            );
        });

        it("all clients can join the test room simultaneously", async () => {
            const joinPromises = clients.map((client) => {
                return new Promise((resolve, reject) => {
                    client.socket.emit(
                        "message",
                        {
                            type: "join",
                            actor: client.actorId,
                            context: "xmpp",
                            target: {
                                type: "room",
                                id: TEST_ROOM,
                            },
                        },
                        (msg) => {
                            if (msg?.error) {
                                reject(
                                    new Error(
                                        `Client ${client.id} join failed: ${msg.error}`,
                                    ),
                                );
                            } else {
                                client.joinedRoom = true;
                                connectionLog.push({
                                    clientId: client.id,
                                    timestamp: Date.now(),
                                    action: "joined_room",
                                });
                                resolve(msg);
                            }
                        },
                    );
                });
            });

            const results = await Promise.all(joinPromises);

            // Verify all clients joined successfully
            expect(results).to.have.length(CLIENT_COUNT);
            expect(clients.filter((c) => c.joinedRoom)).to.have.length(
                CLIENT_COUNT,
            );
        });
    });

    describe("Cross-Client Message Verification", () => {
        it("message from client 1 is received by all other clients", async () => {
            const testMessage = `Test message from client 1 at ${Date.now()}`;
            const sendingClient = clients[0];

            // Clear message log
            messageLog.length = 0;

            // Send message from client 1
            await new Promise((resolve, reject) => {
                sendingClient.socket.emit(
                    "message",
                    {
                        type: "send",
                        actor: sendingClient.actorId,
                        context: "xmpp",
                        object: {
                            type: "message",
                            content: testMessage,
                        },
                        target: {
                            type: "room",
                            id: TEST_ROOM,
                        },
                    },
                    (msg) => {
                        if (msg?.error) {
                            reject(new Error(`Send failed: ${msg.error}`));
                        } else {
                            resolve(msg);
                        }
                    },
                );
            });

            // Wait for messages to propagate to other clients
            await waitFor(
                () =>
                    messageLog.filter(
                        (log) =>
                            log.message?.object?.content === testMessage &&
                            log.message?.type === "message",
                    ).length >=
                    CLIENT_COUNT - 1,
                10000,
            );

            // Verify message was received by other clients
            const receivedMessages = messageLog.filter(
                (log) =>
                    log.message?.object?.content === testMessage &&
                    log.message?.type === "message" &&
                    log.clientId !== sendingClient.id,
            );

            expect(receivedMessages).to.have.length.at.least(CLIENT_COUNT - 1);
        });

        it("rapid messages from multiple clients are all delivered", async () => {
            const testMessages = [];
            messageLog.length = 0;

            // Each client sends a unique message rapidly
            const sendPromises = clients
                .slice(0, 5)
                .map(async (client, index) => {
                    const message = `Rapid message ${index} from client ${client.id} at ${Date.now()}`;
                    testMessages.push(message);

                    return new Promise((resolve, reject) => {
                        client.socket.emit(
                            "message",
                            {
                                type: "send",
                                actor: client.actorId,
                                context: "xmpp",
                                object: {
                                    type: "message",
                                    content: message,
                                },
                                target: {
                                    type: "room",
                                    id: TEST_ROOM,
                                },
                            },
                            (msg) => {
                                if (msg?.error) {
                                    reject(
                                        new Error(`Send failed: ${msg.error}`),
                                    );
                                } else {
                                    resolve(msg);
                                }
                            },
                        );
                    });
                });

            await Promise.all(sendPromises);

            // Wait for all messages to propagate
            await waitFor(() => {
                const receivedCount = testMessages.reduce((count, testMsg) => {
                    const received = messageLog.filter(
                        (log) =>
                            log.message?.object?.content === testMsg &&
                            log.message?.type === "message",
                    ).length;
                    return count + received;
                }, 0);
                return (
                    receivedCount >= testMessages.length * (CLIENT_COUNT - 1)
                );
            }, 15000);

            // Verify all messages were received by all other clients
            for (const testMsg of testMessages) {
                const receivedMessages = messageLog.filter(
                    (log) =>
                        log.message?.object?.content === testMsg &&
                        log.message?.type === "message",
                );
                expect(receivedMessages).to.have.length.at.least(
                    CLIENT_COUNT - 1,
                );
            }
        });
    });

    describe("Client Resilience Testing", () => {
        it("handles client disconnection and reconnection gracefully", async () => {
            const testClient = clients[0];
            const testMessage = `Message after reconnection ${Date.now()}`;

            // Disconnect client
            testClient.socket.disconnect();
            testClient.connected = false;
            testClient.joinedRoom = false;

            // Wait a bit
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Reconnect and rejoin
            testClient.socket.connect();

            // Wait for connection
            await waitFor(() => testClient.socket.connected, 5000);

            // Re-establish credentials and connection
            await new Promise((resolve, reject) => {
                testClient.socket.emit(
                    "credentials",
                    {
                        actor: {
                            id: testClient.actorId,
                            type: "person",
                        },
                        context: "xmpp",
                        type: "credentials",
                        object: {
                            type: "credentials",
                            password: "passw0rd",
                            resource: `SockethubTest${testClient.id}`,
                            userAddress: `user${testClient.id}@prosody`,
                        },
                    },
                    (response) => {
                        if (response?.error) {
                            reject(
                                new Error(
                                    `Credentials failed: ${response.error}`,
                                ),
                            );
                        } else {
                            resolve();
                        }
                    },
                );
            });

            await new Promise((resolve, reject) => {
                testClient.socket.emit(
                    "message",
                    {
                        type: "connect",
                        actor: testClient.actorId,
                        context: "xmpp",
                    },
                    (msg) => {
                        if (msg?.error) {
                            reject(new Error(`Reconnect failed: ${msg.error}`));
                        } else {
                            testClient.connected = true;
                            resolve(msg);
                        }
                    },
                );
            });

            await new Promise((resolve, reject) => {
                testClient.socket.emit(
                    "message",
                    {
                        type: "join",
                        actor: testClient.actorId,
                        context: "xmpp",
                        target: {
                            type: "room",
                            id: TEST_ROOM,
                        },
                    },
                    (msg) => {
                        if (msg?.error) {
                            reject(new Error(`Rejoin failed: ${msg.error}`));
                        } else {
                            testClient.joinedRoom = true;
                            resolve(msg);
                        }
                    },
                );
            });

            // Test that reconnected client can send and receive messages
            messageLog.length = 0;

            await new Promise((resolve, reject) => {
                testClient.socket.emit(
                    "message",
                    {
                        type: "send",
                        actor: testClient.actorId,
                        context: "xmpp",
                        object: {
                            type: "message",
                            content: testMessage,
                        },
                        target: {
                            type: "room",
                            id: TEST_ROOM,
                        },
                    },
                    (msg) => {
                        if (msg?.error) {
                            reject(
                                new Error(
                                    `Send after reconnect failed: ${msg.error}`,
                                ),
                            );
                        } else {
                            resolve(msg);
                        }
                    },
                );
            });

            // Verify other clients received the message
            await waitFor(
                () =>
                    messageLog.filter(
                        (log) =>
                            log.message?.object?.content === testMessage &&
                            log.message?.type === "message" &&
                            log.clientId !== testClient.id,
                    ).length >=
                    CLIENT_COUNT - 1,
                10000,
            );

            const receivedMessages = messageLog.filter(
                (log) =>
                    log.message?.object?.content === testMessage &&
                    log.message?.type === "message" &&
                    log.clientId !== testClient.id,
            );

            expect(receivedMessages).to.have.length.at.least(CLIENT_COUNT - 1);
        });
    });

    describe("Performance and Load Testing", () => {
        it("handles staggered client connections", async () => {
            // Disconnect all clients first
            await Promise.all(
                clients.map((client) => {
                    if (client.socket.connected) {
                        client.socket.disconnect();
                    }
                    client.connected = false;
                    client.joinedRoom = false;
                }),
            );

            // Staggered reconnection with 200ms delays
            for (let i = 0; i < clients.length; i++) {
                const client = clients[i];

                client.socket.connect();
                await waitFor(() => client.socket.connected, 5000);

                // Set credentials and connect
                await new Promise((resolve, reject) => {
                    client.socket.emit(
                        "credentials",
                        {
                            actor: { id: client.actorId, type: "person" },
                            context: "xmpp",
                            type: "credentials",
                            object: {
                                type: "credentials",
                                password: "passw0rd",
                                resource: `SockethubTest${client.id}`,
                                userAddress: `user${client.id}@prosody`,
                            },
                        },
                        (response) => {
                            if (response?.error)
                                reject(new Error(response.error));
                            else resolve();
                        },
                    );
                });

                await new Promise((resolve, reject) => {
                    client.socket.emit(
                        "message",
                        {
                            type: "connect",
                            actor: client.actorId,
                            context: "xmpp",
                        },
                        (msg) => {
                            if (msg?.error) reject(new Error(msg.error));
                            else {
                                client.connected = true;
                                resolve(msg);
                            }
                        },
                    );
                });

                await new Promise((resolve, reject) => {
                    client.socket.emit(
                        "message",
                        {
                            type: "join",
                            actor: client.actorId,
                            context: "xmpp",
                            target: { type: "room", id: TEST_ROOM },
                        },
                        (msg) => {
                            if (msg?.error) reject(new Error(msg.error));
                            else {
                                client.joinedRoom = true;
                                resolve(msg);
                            }
                        },
                    );
                });

                // Wait 200ms before next client
                if (i < clients.length - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 200));
                }
            }

            // Verify all clients are connected and joined
            expect(clients.filter((c) => c.connected)).to.have.length(
                CLIENT_COUNT,
            );
            expect(clients.filter((c) => c.joinedRoom)).to.have.length(
                CLIENT_COUNT,
            );
        });
    });
});
