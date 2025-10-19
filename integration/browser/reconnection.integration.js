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

describe(`XMPP Client Reconnection Tests at ${config.sockethub.url}`, () => {
    validateGlobals();

    let clientRecord = null;
    const messageLog = [];

    before(() => {
        const socket = io(config.sockethub.url, { path: "/sockethub" });
        const sockethubClient = new SockethubClient(socket);
        clientRecord = {
            xmppJid: utils.createXmppJid(1),
            actor: utils.createActorObject(1),
            sockethubClient: sockethubClient,
        };

        sockethubClient.socket.on("message", (msg) => {
            messageLog.push({
                timestamp: Date.now(),
                message: msg,
            });
        });
    });

    after(() => {
        if (clientRecord?.sockethubClient.socket.connected) {
            clientRecord.sockethubClient.socket.disconnect();
        }
    });

    beforeEach(() => {
        messageLog.length = 0;
    });

    describe("Browser Refresh Scenario", () => {
        it("can set credentials", async () => {
            await setXMPPCredentials(
                clientRecord.sockethubClient.socket,
                clientRecord.jid,
            );
        });

        it("can connect to XMPP", async () => {
            clientRecord.sockethubClient.ActivityStreams.Object.create(
                clientRecord.actor,
            );
            await connectXMPP(
                clientRecord.sockethubClient.socket,
                clientRecord.jid,
            );
            clientRecord.connected = true;
        });

        it("can join room", async () => {
            await joinXMPPRoom(
                clientRecord.sockethubClient.socket,
                clientRecord.jid,
                config.prosody.room,
            );
            clientRecord.joinedRoom = true;
        });

        it("handles disconnection and reconnection gracefully (browser refresh)", async () => {
            // This test simulates a browser refresh scenario where:
            // 1. Client disconnects (browser closes/refreshes)
            // 2. Sockethub should maintain the persistent XMPP connection temporarily
            // 3. New client connects with same credentials (new browser session)
            // 4. Should reconnect quickly since Sockethub may have existing connection
            // 5. Client can immediately rejoin room and send messages
            const testMessage = `Message after reconnection ${Date.now()}`;

            // Disconnect client (simulates browser close/refresh)
            if (clientRecord.sockethubClient.socket.connected) {
                clientRecord.sockethubClient.socket.disconnect();
            }
            clientRecord.connected = false;
            clientRecord.joinedRoom = false;

            // Brief wait to simulate browser refresh delay
            await new Promise((resolve) =>
                setTimeout(resolve, config.timeouts.process),
            );

            // Create new client (simulates new browser session)
            const newSocket = io(config.sockethub.url, { path: "/sockethub" });
            const newSockethubClient = new SockethubClient(newSocket);

            // Set up message listener for new socket
            newSockethubClient.socket.on("message", (msg) => {
                messageLog.push({
                    timestamp: Date.now(),
                    message: msg,
                });
            });

            // Replace the disconnected client record
            clientRecord = {
                xmppJid: clientRecord.xmppJid,
                actor: clientRecord.actor,
                sockethubClient: newSockethubClient,
            };

            // Wait for socket connection
            await waitFor(
                () => newSockethubClient.socket.connected,
                config.timeouts.connect,
            );

            // Set credentials (browser would send these again)
            // Use INVALID credentials to simulate the bug scenario
            await setXMPPCredentials(
                newSockethubClient.socket,
                clientRecord.xmppJid,
                undefined, // resource
                "invaliduser", // intentionally wrong username
                "invalidpassword", // intentionally wrong password
            );

            // Connect (should be fast due to persistent XMPP connection)
            await connectXMPP(newSockethubClient.socket, clientRecord.xmppJid);
            clientRecord.connected = true;

            // Rejoin room
            await joinXMPPRoom(
                newSockethubClient.socket,
                clientRecord.xmppJid,
                config.prosody.room,
            );
            clientRecord.joinedRoom = true;

            // Test that reconnected client can send messages
            messageLog.length = 0;

            await sendXMPPMessage(
                newSockethubClient.socket,
                clientRecord.xmppJid,
                config.prosody.room,
                testMessage,
            );

            // Verify the message was sent successfully (no timeout or error)
            // In a single-client scenario, we just verify the send operation completed
            // The fact that we got here without an exception means reconnection worked
            expect(clientRecord.connected).to.be.true;
            expect(clientRecord.joinedRoom).to.be.true;
        });
    });
});
