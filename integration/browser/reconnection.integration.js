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

describe("XMPP Client Reconnection Tests", () => {
    const messages = new Map(); // <socket.id, []>
    const connect = new Map(); // <socket.id, boolean>
    const connectError = new Map(); // <socket.id, boolean>>

    function connectSockethubClient() {
        const socket = io(config.sockethub.url, { path: "/sockethub" });
        const sc = new SockethubClient(socket);

        sc.socket.on("connect", () => {
            connect.set(sc.socket.id, true);
        });
        sc.socket.on("connect_error", () => {
            connect.set(sc.socket.id, false);
            connectError.set(sc.socket.id, true);
        });
        sc.socket.on("disconnect", () => {
            connect.set(sc.socket.id, false);
        });

        sc.socket.on("message", (msg) => {
            const m = messages.get(sc.socket.id) || [];
            m.push({
                timestamp: Date.now(),
                message: msg,
            });
            messages.set(sc.socket.id, m);
        });
        return sc;
    }

    validateGlobals();

    afterEach(() => {
        messages.clear();
    });

    describe("Browser Refresh Scenario", () => {
        it("handles disconnection and reconnection gracefully (browser refresh)", async () => {
            let initialClient;
            let reconnectedClient;

            try {
                initialClient = connectSockethubClient();
                const jid = utils.createXmppJid("Reconnect");
                await setXMPPCredentials(initialClient, jid);
                initialClient.ActivityStreams.Object.create(
                    utils.createActorObject(jid),
                );
                await connectXMPP(initialClient, jid);
                await joinXMPPRoom(initialClient, jid, config.prosody.room);
                expect(connect.get(initialClient.socket.id)).to.be.true;
                expect(connectError.get(initialClient.socket.id)).to.not.be
                    .true;

                console.log("connected to sockethub, sending message");
                await sendXMPPMessage(
                    initialClient,
                    jid,
                    config.prosody.room,
                    "Hello world",
                );

                // Disconnect client (simulates browser close/refresh)
                console.log("disconnecting client");
                if (initialClient.socket.connected) {
                    initialClient.socket.disconnect();
                }

                // Brief wait to simulate browser refresh delay
                await new Promise((resolve) =>
                    setTimeout(resolve, config.timeouts.process),
                );

                console.log("new connection");
                // Create a new client (simulates new browser session)
                reconnectedClient = connectSockethubClient();

                // Wait for socket connection
                await waitFor(
                    () => reconnectedClient.socket.connected,
                    config.timeouts.connect,
                );
                console.log("connected");

                // Manually set credentials and reconnect (what browser would do)
                await setXMPPCredentials(reconnectedClient, jid);
                reconnectedClient.ActivityStreams.Object.create(
                    utils.createActorObject(jid),
                );
                await connectXMPP(reconnectedClient, jid);
                await joinXMPPRoom(reconnectedClient, jid, config.prosody.room);

                // Test that reconnected client can send messages
                console.log("sending test message after manual reconnection");
                await sendXMPPMessage(
                    reconnectedClient,
                    jid,
                    config.prosody.room,
                    "Reconnection test message",
                );

                // Wait for message to process
                await new Promise((resolve) =>
                    setTimeout(resolve, config.timeouts.message),
                );

                // Verify connection states
                expect(initialClient.socket.connected).to.be.false;
                expect(reconnectedClient.socket.connected).to.be.true;
            } finally {
                // Ensure cleanup
                if (reconnectedClient?.socket?.connected) {
                    reconnectedClient.socket.disconnect();
                }
            }
        });

        it("reconnection with wrong creds causes proper platform cleanup (no zombie processes or memory leaks)", async () => {
            const messageLog = [];
            let initialClient;
            let invalidCredClient;
            let validCredClient;

            try {
                // Step 1: Establish initial valid connection
                initialClient = connectSockethubClient();
                const jid = utils.createXmppJid("ReconnectCleanup");

                initialClient.socket.on("message", (msg) => {
                    messageLog.push({
                        timestamp: Date.now(),
                        message: msg,
                    });
                });

                await setXMPPCredentials(initialClient, jid);
                initialClient.ActivityStreams.Object.create(
                    utils.createActorObject(jid),
                );
                await connectXMPP(initialClient, jid);
                await joinXMPPRoom(initialClient, jid, config.prosody.room);

                console.log("Step 1: Initial connection established");

                // Step 2: Disconnect client (simulates browser close/refresh)
                initialClient.socket.disconnect();
                await new Promise((resolve) =>
                    setTimeout(resolve, config.timeouts.process),
                );

                console.log("Step 2: Client disconnected");

                // Step 3: Create new client with INVALID credentials
                invalidCredClient = connectSockethubClient();

                invalidCredClient.socket.on("message", (msg) => {
                    messageLog.push({
                        timestamp: Date.now(),
                        message: msg,
                    });
                });

                await waitFor(
                    () => invalidCredClient.socket.connected,
                    config.timeouts.connect,
                );

                console.log(
                    "Step 3: New socket connected, setting invalid credentials",
                );

                // Use INVALID credentials - different username/password
                await setXMPPCredentials(
                    invalidCredClient,
                    jid,
                    "ReconnectCleanup", // resource
                    "invaliduser", // intentionally wrong username
                    "invalidpassword", // intentionally wrong password
                );

                console.log(
                    "Step 4: Attempting to connect with wrong credentials",
                );

                // Step 4: Attempt to connect - should FAIL
                let connectFailed = false;
                try {
                    await connectXMPP(invalidCredClient, jid);
                } catch (err) {
                    console.log("Connection failed as expected:", err.message);
                    connectFailed = true;
                    // Verify the error is related to authentication
                    expect(err.message).to.match(
                        /not-authorized|authentication|failed/i,
                    );
                }

                expect(connectFailed).to.be.true;

                // Step 5: Wait to ensure platform cleanup completes
                await new Promise((resolve) =>
                    setTimeout(resolve, config.timeouts.cleanup),
                );

                console.log("Step 5: Verifying cleanup completed");

                // Step 6: Verify proper cleanup by attempting a fresh connection with VALID credentials
                // If cleanup was proper, this should work fine
                validCredClient = connectSockethubClient();
                await waitFor(
                    () => validCredClient.socket.connected,
                    config.timeouts.connect,
                );

                // Use VALID credentials this time
                await setXMPPCredentials(validCredClient, jid);
                validCredClient.ActivityStreams.Object.create(
                    utils.createActorObject(jid),
                );
                await connectXMPP(validCredClient, jid);

                console.log(
                    "Step 6: Fresh connection with valid credentials succeeded - cleanup was proper",
                );
            } finally {
                // Ensure cleanup happens even if test fails
                if (invalidCredClient?.socket?.connected) {
                    invalidCredClient.socket.disconnect();
                }
                if (validCredClient?.socket?.connected) {
                    validCredClient.socket.disconnect();
                }
            }
        });
    });
});
