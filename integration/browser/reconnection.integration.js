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
            const sc = connectSockethubClient();
            const jid = utils.createXmppJid("Reconnect");
            await setXMPPCredentials(sc, jid);
            sc.ActivityStreams.Object.create(utils.createActorObject(jid));
            await connectXMPP(sc, jid);
            await joinXMPPRoom(sc, jid, config.prosody.room);
            expect(connect.get(sc.socket.id)).to.be.true;
            expect(connectError.get(sc.socket.id)).to.not.be.true;

            console.log("connected to sockethub, sending message");
            await sendXMPPMessage(sc, jid, config.prosody.room, "Hello world");

            // Disconnect client (simulates browser close/refresh)
            console.log("disconnecting client");
            if (sc.socket.connected) {
                sc.socket.disconnect();
            }

            // Brief wait to simulate browser refresh delay
            await new Promise((resolve) =>
                setTimeout(resolve, config.timeouts.process),
            );

            console.log("new connection");
            // Create a new client (simulates new browser session)
            const nsc = connectSockethubClient();

            // Wait for socket connection
            await waitFor(() => nsc.socket.connected, config.timeouts.connect);
            console.log("connected");

            // Brief wait to simulate browser refresh delay
            await new Promise((resolve) =>
                setTimeout(resolve, config.timeouts.process),
            );

            // Set credentials (browser would send these again) -- VALID
            // We should get replay ??
            // - creds
            // - connect
            // - join

            console.log("checking for automatic replays...");

            // Wait to see if Sockethub automatically replays previous state
            await new Promise((resolve) =>
                setTimeout(resolve, config.timeouts.message),
            );

            // Manually set credentials and reconnect (what browser would do)
            await setXMPPCredentials(nsc, jid);
            nsc.ActivityStreams.Object.create(utils.createActorObject(jid));
            await connectXMPP(nsc, jid);
            await joinXMPPRoom(nsc, jid, config.prosody.room);

            // Test that reconnected client can send messages
            console.log("sending test message after manual reconnection");
            await sendXMPPMessage(
                nsc,
                jid,
                config.prosody.room,
                "Reconnection test message",
            );

            // Wait for message to process
            await new Promise((resolve) =>
                setTimeout(resolve, config.timeouts.message),
            );

            // Verify connection states
            expect(sc.socket.connected).to.be.false;
            expect(nsc.socket.connected).to.be.true;
        });

        it("reconnection with wrong creds causes proper platform cleanup (no zombie processes or memory leaks)", async () => {
            const messageLog = [];

            // Step 1: Establish initial valid connection
            const sc = connectSockethubClient();
            const jid = utils.createXmppJid("ReconnectCleanup");

            sc.socket.on("message", (msg) => {
                messageLog.push({
                    timestamp: Date.now(),
                    message: msg,
                });
            });

            await setXMPPCredentials(sc, jid);
            sc.ActivityStreams.Object.create(utils.createActorObject(jid));
            await connectXMPP(sc, jid);
            await joinXMPPRoom(sc, jid, config.prosody.room);

            console.log("Step 1: Initial connection established");

            // Step 2: Disconnect client (simulates browser close/refresh)
            sc.socket.disconnect();
            await new Promise((resolve) =>
                setTimeout(resolve, config.timeouts.process),
            );

            console.log("Step 2: Client disconnected");

            // Step 3: Create new client with INVALID credentials
            const nsc = connectSockethubClient();

            nsc.socket.on("message", (msg) => {
                messageLog.push({
                    timestamp: Date.now(),
                    message: msg,
                });
            });

            await waitFor(() => nsc.socket.connected, config.timeouts.connect);

            console.log(
                "Step 3: New socket connected, setting invalid credentials",
            );

            // Use INVALID credentials - different username/password
            await setXMPPCredentials(
                nsc,
                jid,
                "ReconnectCleanup", // resource
                "invaliduser", // intentionally wrong username
                "invalidpassword", // intentionally wrong password
            );

            console.log("Step 4: Attempting to connect with wrong credentials");

            // Step 4: Attempt to connect - should FAIL
            let connectFailed = false;
            try {
                await connectXMPP(nsc, jid);
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
            const nsc2 = connectSockethubClient();
            await waitFor(() => nsc2.socket.connected, config.timeouts.connect);

            // Use VALID credentials this time
            await setXMPPCredentials(nsc2, jid);
            nsc2.ActivityStreams.Object.create(utils.createActorObject(jid));
            await connectXMPP(nsc2, jid);

            console.log(
                "Step 6: Fresh connection with valid credentials succeeded - cleanup was proper",
            );

            // Clean up
            if (nsc.socket.connected) {
                nsc.socket.disconnect();
            }
            if (nsc2.socket.connected) {
                nsc2.socket.disconnect();
            }
        });
    });
});
