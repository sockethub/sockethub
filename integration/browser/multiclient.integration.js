import { expect } from "@esm-bundle/chai";
import {
    SH_PORT,
    connectXMPP,
    createSockethubClient,
    joinXMPPRoom,
    sendXMPPMessage,
    setXMPPCredentials,
    validateGlobals,
    waitFor,
} from "./shared-setup.js";

const TEST_ROOM = "testroom@prosody";
const CLIENT_COUNT = 10;

describe(`Multi-Client XMPP Integration Tests at port ${SH_PORT}`, () => {
    validateGlobals();

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

        const clientSetup = createSockethubClient(`user${userId}`);

        // Track all incoming messages for verification
        clientSetup.client.socket.on("message", (msg) => {
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
            ...clientSetup,
            connected: false,
            joinedRoom: false,
        };
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
            client.cleanup();
        }
        clients = [];
    });

    beforeEach(() => {
        messageLog.length = 0;
        connectionLog.length = 0;
    });

    describe("Concurrent Client Connections", () => {
        it("all clients can set credentials simultaneously", async () => {
            const credentialPromises = clients.map((client) =>
                setXMPPCredentials(
                    client.socket,
                    client.actorId,
                    `user${client.id}`,
                    "passw0rd",
                ),
            );

            await Promise.all(credentialPromises);
        });

        it("all clients can connect simultaneously", async () => {
            const connectPromises = clients.map((client) => {
                return new Promise((resolve, reject) => {
                    // Create activity object first
                    client.client.ActivityStreams.Object.create(
                        client.actorObject,
                    );

                    connectXMPP(client.socket, client.actorId)
                        .then((msg) => {
                            client.connected = true;
                            connectionLog.push({
                                clientId: client.id,
                                timestamp: Date.now(),
                                action: "connected",
                            });
                            resolve(msg);
                        })
                        .catch(reject);
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
                return joinXMPPRoom(
                    client.socket,
                    client.actorId,
                    TEST_ROOM,
                ).then((msg) => {
                    client.joinedRoom = true;
                    connectionLog.push({
                        clientId: client.id,
                        timestamp: Date.now(),
                        action: "joined_room",
                    });
                    return msg;
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
            await sendXMPPMessage(
                sendingClient.socket,
                sendingClient.actorId,
                TEST_ROOM,
                testMessage,
            );

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

                    return sendXMPPMessage(
                        client.socket,
                        client.actorId,
                        TEST_ROOM,
                        message,
                    );
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
            await setXMPPCredentials(
                testClient.socket,
                testClient.actorId,
                `user${testClient.id}`,
                "passw0rd",
            );

            await connectXMPP(testClient.socket, testClient.actorId);
            testClient.connected = true;

            await joinXMPPRoom(
                testClient.socket,
                testClient.actorId,
                TEST_ROOM,
            );
            testClient.joinedRoom = true;

            // Test that reconnected client can send and receive messages
            messageLog.length = 0;

            await sendXMPPMessage(
                testClient.socket,
                testClient.actorId,
                TEST_ROOM,
                testMessage,
            );

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
            for (const client of clients) {
                if (client.socket.connected) {
                    client.socket.disconnect();
                }
                client.connected = false;
                client.joinedRoom = false;
            }

            // Staggered reconnection with 200ms delays
            for (let i = 0; i < clients.length; i++) {
                const client = clients[i];

                client.socket.connect();
                await waitFor(() => client.socket.connected, 5000);

                // Set credentials and connect
                await setXMPPCredentials(
                    client.socket,
                    client.actorId,
                    `user${client.id}`,
                    "passw0rd",
                );

                await connectXMPP(client.socket, client.actorId);
                client.connected = true;

                await joinXMPPRoom(client.socket, client.actorId, TEST_ROOM);
                client.joinedRoom = true;

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
