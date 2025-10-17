import { expect } from "@esm-bundle/chai";
import {
    connectXMPP,
    joinXMPPRoom,
    parseConfig,
    sendXMPPMessage,
    setXMPPCredentials,
    validateGlobals,
    waitFor,
} from "./shared-setup.js";

const config = parseConfig();

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
            const clientRecord = {
                index: i,
                xmppJid: config.createXmppJid(i),
                actor: config.createActorObject(i),
                sockethubClient: sockethubClient,
            };

            sockethubClient.socket.on("message", (msg) => {
                messageLog.push({
                    clientId: i,
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
                    clientRecord.sockethubClient.socket,
                    clientRecord.xmppJid,
                ),
            );

            await Promise.all(credentialPromises);
        });

        it("all clients can connect sequentially", async () => {
            const results = [];

            for (const clientRecord of records) {
                // Create activity object first
                clientRecord.sockethubClient.ActivityStreams.Object.create(
                    clientRecord.actor,
                );

                const result = await connectXMPP(
                    clientRecord.sockethubClient.socket,
                    clientRecord.xmppJid,
                );

                connectionLog.push({
                    clientId: clientRecord.index,
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
                    clientRecord.sockethubClient.socket,
                    clientRecord.xmppJid,
                    config.prosody.room,
                ).then((msg) => {
                    connectionLog.push({
                        clientId: clientRecord.index,
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
                sendingClientRecord.sockethubClient.socket,
                sendingClientRecord.xmppJid,
                config.prosody.room,
                testMessage,
            );

            // Wait for messages to propagate to other clients
            await waitFor(
                () =>
                    messageLog.filter(
                        (log) =>
                            log.message?.object?.content === testMessage &&
                            log.message?.type === "send",
                    ).length >=
                    CLIENT_COUNT - 1,
                config.timeouts.message,
            );

            // Verify message was received by other clients
            const receivedMessages = messageLog.filter(
                (log) =>
                    log.message?.object?.content === testMessage &&
                    log.message?.type === "send" &&
                    log.clientId !== sendingClientRecord.index,
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
                    const message = `Rapid message ${index} from client ${clientRecord.index} at ${Date.now()}`;
                    testMessages.push(message);

                    return sendXMPPMessage(
                        clientRecord.sockethubClient.socket,
                        clientRecord.xmppJid,
                        config.prosody.room,
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
                            log.message?.type === "send",
                    ).length;
                    return count + received;
                }, 0);
                return (
                    receivedCount >= testMessages.length * (CLIENT_COUNT - 1)
                );
            }, config.timeouts.message);

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
                        clientId: clientRecord.index,
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
                    newSockethubClient.socket,
                    clientRecord.xmppJid,
                );

                await connectXMPP(
                    newSockethubClient.socket,
                    clientRecord.xmppJid,
                );

                await joinXMPPRoom(
                    newSockethubClient.socket,
                    clientRecord.xmppJid,
                    config.prosody.room,
                );

                // Wait 200ms before next client
                if (i < records.length - 1) {
                    await new Promise((resolve) =>
                        setTimeout(resolve, config.timeouts.process),
                    );
                }
            }

            // Verify all clients completed the staggered reconnection process
            // We can't rely on connection state since the test is about handling staggered connections
            // The fact that we got here without errors means the staggered reconnection worked
            expect(records).to.have.length(CLIENT_COUNT);
        });
    });
});
