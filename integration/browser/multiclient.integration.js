import { expect } from "@esm-bundle/chai";
import {
    connectXMPP,
    joinXMPPRoom,
    sendXMPPMessage,
    setXMPPCredentials,
    validateGlobals,
    waitFor,
} from "./shared-setup.js";

import "./../config.js";

const config = window.SH_CONFIG;

const CLIENT_COUNT = 3;

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
                setXMPPCredentials(clientRecord.sockethubClient.socket, clientRecord.xmppJid),
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

                clientRecord.connected = true;
                connectionLog.push({
                    clientId: clientRecord.index,
                    timestamp: Date.now(),
                    action: "connected",
                });
                results.push(result);
            }

            // Verify all clients connected successfully
            expect(results).to.have.length(CLIENT_COUNT);
            expect(records.filter((c) => c.connected)).to.have.length(
                CLIENT_COUNT,
            );
        });

        it("all clients can join the test room simultaneously", async () => {
            const joinPromises = records.map((clientRecord) => {
                return joinXMPPRoom(
                    clientRecord.sockethubClient.socket,
                    clientRecord.xmppJid,
                    config.prosody.room,
                ).then((msg) => {
                    clientRecord.joinedRoom = true;
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
            expect(records.filter((c) => c.joinedRoom)).to.have.length(
                CLIENT_COUNT,
            );
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

    describe("Client Resilience Testing", () => {
        it("handles client disconnection and reconnection gracefully (browser refresh)", async () => {
            // This test simulates a browser refresh scenario where:
            // 1. Client disconnects (browser closes/refreshes)
            // 2. Sockethub maintains the persistent XMPP connection temporarily
            // 3. New client connects with same credentials (new browser session)
            // 4. Should reconnect quickly since Sockethub has existing connection
            // 5. Client can immediately rejoin room and exchange messages
            const testClientRecord = records[0];
            const testMessage = `Message after reconnection ${Date.now()}`;

            // Disconnect client (simulates browser close/refresh)
            if (testClientRecord.sockethubClient.socket.connected) {
                testClientRecord.sockethubClient.socket.disconnect();
            }
            testClientRecord.connected = false;
            testClientRecord.joinedRoom = false;

            // Brief wait to simulate browser refresh delay
            await new Promise((resolve) =>
                setTimeout(resolve, config.timeouts.process),
            );

            // Create new client (simulates new browser session)
            const newSocket = io(config.sockethub.url, { path: "/sockethub" });
            const newSockethubClient = new SockethubClient(newSocket);
            
            // Replace the disconnected client record
            records[0] = {
                index: testClientRecord.index,
                xmppJid: testClientRecord.xmppJid,
                actor: testClientRecord.actor,
                sockethubClient: newSockethubClient,
            };

            // Wait for socket connection
            await waitFor(
                () => newSockethubClient.socket.connected,
                config.timeouts.connection,
            );

            // Set credentials (browser would send these again)
            await setXMPPCredentials(newSockethubClient.socket, testClientRecord.xmppJid);

            // Connect (should be fast due to persistent XMPP connection)
            await connectXMPP(newSockethubClient.socket, testClientRecord.xmppJid);
            records[0].connected = true;

            // Rejoin room
            await joinXMPPRoom(
                newSockethubClient.socket,
                testClientRecord.xmppJid,
                config.prosody.room,
            );
            records[0].joinedRoom = true;

            // Test that reconnected client can send and receive messages
            messageLog.length = 0;

            await sendXMPPMessage(
                newSockethubClient.socket,
                testClientRecord.xmppJid,
                config.prosody.room,
                testMessage,
            );

            // Verify other clients received the message
            await waitFor(
                () =>
                    messageLog.filter(
                        (log) =>
                            log.message?.object?.content === testMessage &&
                            log.message?.type === "send" &&
                            log.clientId !== testClientRecord.index,
                    ).length >=
                    CLIENT_COUNT - 1,
                config.timeouts.message,
            );

            const receivedMessages = messageLog.filter(
                (log) =>
                    log.message?.object?.content === testMessage &&
                    log.message?.type === "send" &&
                    log.clientId !== testClientRecord.index,
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
            for (const clientRecord of records) {

                client.socket.connect();
                await waitFor(
                    () => client.socket.connected,
                    config.timeouts.connection,
                );

                // Set credentials and connect
                await setXMPPCredentials(client.socket, client.actorId);

                await connectXMPP(client.socket, client.actorId);
                client.connected = true;

                await joinXMPPRoom(
                    client.socket,
                    client.actorId,
                    config.prosody.room,
                );
                client.joinedRoom = true;

                // Wait 200ms before next client
                if (i < clients.length - 1) {
                    await new Promise((resolve) =>
                        setTimeout(resolve, config.timeouts.process),
                    );
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
