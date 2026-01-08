import { expect } from "@esm-bundle/chai";
import createTestUtils from "../utils.js";
import {
    connectXMPP,
    getConfig,
    joinXMPPRoom,
    sendXMPPMessage,
    setXMPPCredentials,
    validateGlobals,
    waitFor,
} from "./shared-setup.js";

const config = getConfig();
const utils = createTestUtils(config);

const CLIENT_COUNT = 10;

describe(`Multi-Client XMPP Integration Tests at ${config.sockethub.url}`, () => {
    validateGlobals();

    let records = [];
    const messageLog = [];
    const connectionLog = [];

    before(() => {
        for (let i = 1; i <= CLIENT_COUNT; i++) {
            const socket = io(config.sockethub.url, { path: "/sockethub" });
            const sockethubClient = new SockethubClient(socket);
            const resource = `${config.prosody.resource}${i}`;

            const clientRecord = {
                resource: resource,
                jid: utils.createXmppJid(resource),
                sockethubClient: sockethubClient,
            };

            sockethubClient.socket.on("message", (msg) => {
                messageLog.push({
                    clientId: clientRecord.jid,
                    timestamp: Date.now(),
                    message: msg,
                });
            });

            records.push(clientRecord);
        }
    });

    after(() => {
        // Cleanup all clients
        for (const clientRecord of records) {
            if (clientRecord.sockethubClient.socket.connected) {
                clientRecord.sockethubClient.socket.disconnect();
            }
        }
        records = [];
    });

    beforeEach(() => {
        messageLog.length = 0;
        connectionLog.length = 0;
    });

    describe("Concurrent Client Connections", () => {
        it("all clients can set credentials simultaneously", async () => {
            const credentialPromises = records.map((clientRecord) =>
                setXMPPCredentials(
                    clientRecord.sockethubClient,
                    clientRecord.jid,
                    clientRecord.resource,
                ),
            );

            await Promise.all(credentialPromises);
        });

        it("all clients can connect sequentially", async () => {
            const results = [];

            for (const clientRecord of records) {
                // Create activity object first
                clientRecord.sockethubClient.ActivityStreams.Object.create(
                    utils.createActorObject(clientRecord.jid),
                );

                const result = await connectXMPP(
                    clientRecord.sockethubClient,
                    clientRecord.jid,
                );

                connectionLog.push({
                    clientId: clientRecord.jid,
                    timestamp: Date.now(),
                    action: "connected",
                });
                results.push(result);
            }

            // Verify all clients connected successfully
            expect(results).to.have.length(CLIENT_COUNT);
        });

        it("all clients can join the test room simultaneously", async () => {
            const joinPromises = records.map((clientRecord) => {
                return joinXMPPRoom(
                    clientRecord.sockethubClient,
                    clientRecord.jid,
                ).then((msg) => {
                    connectionLog.push({
                        clientId: clientRecord.jid,
                        timestamp: Date.now(),
                        action: "joined_room",
                    });
                    return msg;
                });
            });

            const results = await Promise.all(joinPromises);

            // Verify all clients joined successfully
            expect(results).to.have.length(CLIENT_COUNT);
        });
    });

    describe("Cross-Client Message Verification", () => {
        it("message from client 1 is received by all other clients", async () => {
            const testMessage = `Test message from client 1 at ${Date.now()}`;
            const sendingClientRecord = records[0];

            // Clear message log
            messageLog.length = 0;

            // Send message from client 1
            await sendXMPPMessage(
                sendingClientRecord.sockethubClient,
                sendingClientRecord.jid,
                config.prosody.room,
                testMessage,
            );

            // Wait for messages to propagate to other clients
            // Use longer timeout for multi-client tests due to XMPP routing delays
            await waitFor(
                () =>
                    messageLog.filter(
                        (log) =>
                            log.message?.object?.content === testMessage &&
                            log.message?.type === "send",
                    ).length >=
                    CLIENT_COUNT - 1,
                config.timeouts.multiClientMessage,
                50,
                () =>
                    `Received ${messageLog.filter((log) => log.message?.object?.content === testMessage).length}/${CLIENT_COUNT - 1} messages`,
            );

            // Verify message was received by other clients
            const receivedMessages = messageLog.filter(
                (log) =>
                    log.message?.object?.content === testMessage &&
                    log.message?.type === "send" &&
                    log.clientId !== sendingClientRecord.jid,
            );

            expect(receivedMessages).to.have.length.at.least(CLIENT_COUNT - 1);
        });

        it("rapid messages from multiple clients are all delivered", async () => {
            const testMessages = [];
            messageLog.length = 0;

            // Each client sends a unique message rapidly
            const sendPromises = records
                .slice(0, 3)
                .map(async (clientRecord, index) => {
                    const message = `Rapid message ${index} from client ${clientRecord.jid} at ${Date.now()}`;
                    testMessages.push(message);

                    return sendXMPPMessage(
                        clientRecord.sockethubClient,
                        clientRecord.jid,
                        config.prosody.room,
                        message,
                    );
                });

            await Promise.all(sendPromises);

            // Wait for all messages to propagate
            // Use longer timeout for rapid multi-client message delivery
            const expectedMessageCount =
                testMessages.length * (CLIENT_COUNT - 1);
            await waitFor(
                () => {
                    const receivedCount = testMessages.reduce(
                        (count, testMsg) => {
                            const received = messageLog.filter(
                                (log) =>
                                    log.message?.object?.content === testMsg &&
                                    log.message?.type === "send",
                            ).length;
                            return count + received;
                        },
                        0,
                    );
                    return receivedCount >= expectedMessageCount;
                },
                config.timeouts.multiClientMessage,
                50,
                () => {
                    const receivedCount = testMessages.reduce(
                        (count, testMsg) => {
                            const received = messageLog.filter(
                                (log) =>
                                    log.message?.object?.content === testMsg &&
                                    log.message?.type === "send",
                            ).length;
                            return count + received;
                        },
                        0,
                    );
                    return `Received ${receivedCount}/${expectedMessageCount} messages`;
                },
            );

            // Verify all messages were received by all other clients
            for (const testMsg of testMessages) {
                const receivedMessages = messageLog.filter(
                    (log) =>
                        log.message?.object?.content === testMsg &&
                        log.message?.type === "send",
                );
                expect(receivedMessages).to.have.length.at.least(
                    CLIENT_COUNT - 1,
                );
            }
        });
    });

    describe("Performance and Load Testing", () => {
        it("handles staggered client connections", async () => {
            // Disconnect all clients first
            for (const clientRecord of records) {
                if (clientRecord.sockethubClient.socket.connected) {
                    clientRecord.sockethubClient.socket.disconnect();
                }
            }

            // Staggered reconnection with 200ms delays
            for (let i = 0; i < records.length; i++) {
                const clientRecord = records[i];

                // Create new socket for reconnection
                const newSocket = io(config.sockethub.url, {
                    path: "/sockethub",
                });
                const newSockethubClient = new SockethubClient(newSocket);

                // Set up message listener
                newSockethubClient.socket.on("message", (msg) => {
                    messageLog.push({
                        clientId: clientRecord.jid,
                        timestamp: Date.now(),
                        message: msg,
                    });
                });

                // Update the client record
                clientRecord.sockethubClient = newSockethubClient;

                // Wait for socket to connect using a Promise
                await new Promise((resolve, reject) => {
                    if (newSockethubClient.socket.connected) {
                        resolve();
                    } else {
                        const connectHandler = () => {
                            newSockethubClient.socket.off(
                                "connect",
                                connectHandler,
                            );
                            newSockethubClient.socket.off(
                                "connect_error",
                                errorHandler,
                            );
                            resolve();
                        };
                        const errorHandler = (error) => {
                            newSockethubClient.socket.off(
                                "connect",
                                connectHandler,
                            );
                            newSockethubClient.socket.off(
                                "connect_error",
                                errorHandler,
                            );
                            reject(
                                new Error(`Socket connection failed: ${error}`),
                            );
                        };

                        newSockethubClient.socket.on("connect", connectHandler);
                        newSockethubClient.socket.on(
                            "connect_error",
                            errorHandler,
                        );

                        // Add timeout
                        setTimeout(() => {
                            newSockethubClient.socket.off(
                                "connect",
                                connectHandler,
                            );
                            newSockethubClient.socket.off(
                                "connect_error",
                                errorHandler,
                            );
                            reject(new Error("Socket connection timeout"));
                        }, config.timeouts.connect);
                    }
                });

                // Set credentials and connect
                await setXMPPCredentials(
                    newSockethubClient,
                    clientRecord.jid,
                    clientRecord.resource,
                );

                await connectXMPP(newSockethubClient, clientRecord.jid);

                await joinXMPPRoom(newSockethubClient, clientRecord.jid);

                // Wait 200ms before next client
                if (i < records.length - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 200));
                }
            }

            // Verify all clients completed the staggered reconnection process
            // We can't rely on connection state since the test is about handling staggered connections
            // The fact that we got here without errors means the staggered reconnection worked
            expect(records).to.have.length(CLIENT_COUNT);
        });

        it("rejects connection with mismatched credentials (same actor, different credentials)", async () => {
            // Take first client's JID but use different resource credentials
            const originalClient = records[0];
            const originalJid = originalClient.jid;
            const wrongResource = "DifferentResource"; // Different from SockethubTest1

            // Create a new socket connection
            const newSocket = io(config.sockethub.url, {
                path: "/sockethub",
            });
            const newSockethubClient = new SockethubClient(newSocket);

            let connectError = null;

            // Set up error listener
            newSockethubClient.socket.on("message", (msg) => {
                if (msg.type === "error") {
                    connectError = msg.error;
                }
            });

            // Wait for socket to connect
            await waitFor(
                () => newSockethubClient.socket.connected,
                config.timeouts.connect,
            );

            // Set WRONG credentials (same actor JID, different resource)
            await setXMPPCredentials(
                newSockethubClient,
                originalJid,
                wrongResource,
            );

            // Try to connect - this should fail with credential error
            try {
                await connectXMPP(newSockethubClient, originalJid);
                // If we reach here, the test should fail
                expect.fail(
                    "Connection should have been rejected with mismatched credentials",
                );
            } catch (error) {
                // Connection should fail
                expect(error.message).to.include("Connect failed");
                expect(error.message).to.include("invalid credentials");
            } finally {
                // Clean up
                newSockethubClient.socket.disconnect();
            }
        });
    });
});
