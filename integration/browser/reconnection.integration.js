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
            console.log("-- socket connected: ", sc.socket.id);
            connect.set(sc.socket.id, true);
        });
        sc.socket.on("connect_error", () => {
            console.log("socket connect error: ", sc.socket.id);
            connect.set(sc.socket.id, false);
            connectError.set(sc.socket.id, true);
        });
        sc.socket.on("disconnect", () => {
            console.log("socket disconnect: ", sc.socket.id);
            connect.set(sc.socket.id, false);
        });

        sc.socket.on("message", (msg) => {
            console.log(`${sc.socket.id} message received: `, msg);
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
        it("handles disconnection and reconnection gracefully (browser refresh) [working]", async () => {
            const sc = connectSockethubClient();
            const jid = utils.createXmppJid("Reconnect");
            await setXMPPCredentials(sc, jid);
            sc.ActivityStreams.Object.create(utils.createActorObject(jid));
            await connectXMPP(sc, jid);
            await joinXMPPRoom(sc, jid, config.prosody.room);
            expect(connect.get(sc.socket.id)).to.be.true;
            expect(connectError.get(sc.socket.id)).to.not.be.true;
            const m = messages.get(sc.socket.id) || [];
            console.log("messages: ", m);
            // expect(m.length).to.equal(0);

            console.log("connected to sockethub, sending message");
            await sendXMPPMessage(sc, jid, config.prosody.room, "Hello world");

            // Disconnect client (simulates browser close/refresh)
            console.log("disconnecting client");
            if (sc.socket.connected) {
                sc.socket.disconnect();
            }

            console.log("...");

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
            await new Promise((resolve) => setTimeout(resolve, 3000));

            const replayMessages = messages.get(nsc.socket.id) || [];
            console.log("replay messages received:", replayMessages);

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
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Test that the reconnected client can send messages
            console.log("old sc messages: ", messages.get(sc.socket.id));
            console.log("new sc messages: ", messages.get(nsc.socket.id));
            expect(sc.socket.connected).to.be.false;
            expect(nsc.socket.connected).to.be.true;
        });

        // it("reconnection with wrong creds causes platform cleanup and crash", async () => {
        //     const testMessage = `Message after reconnection ${Date.now()}`;
        //
        //     // Disconnect client (simulates browser close/refresh)
        //     if (clientRecord.sockethubClient.socket.connected) {
        //         clientRecord.sockethubClient.socket.disconnect();
        //     }
        //     clientRecord.connected = false;
        //     clientRecord.joinedRoom = false;
        //
        //     // Brief wait to simulate browser refresh delay
        //     await new Promise((resolve) =>
        //         setTimeout(resolve, config.timeouts.process),
        //     );
        //
        //     // Create new client (simulates new browser session)
        //     const newSocket = io(config.sockethub.url, { path: "/sockethub" });
        //     const newSockethubClient = new SockethubClient(newSocket);
        //
        //     // Set up message listener for new socket
        //     newSockethubClient.socket.on("message", (msg) => {
        //         messageLog.push({
        //             timestamp: Date.now(),
        //             message: msg,
        //         });
        //     });
        //
        //     // Replace the disconnected client record
        //     clientRecord = {
        //         xmppJid: clientRecord.xmppJid,
        //         actor: clientRecord.actor,
        //         sockethubClient: newSockethubClient,
        //     };
        //
        //     // Wait for socket connection
        //     await waitFor(
        //         () => newSockethubClient.socket.connected,
        //         config.timeouts.connect,
        //     );
        //
        //     // Set credentials (browser would send these again)
        //     // Use INVALID credentials to simulate the bug scenario
        //     await setXMPPCredentials(
        //         newSockethubClient.socket,
        //         clientRecord.xmppJid,
        //         undefined, // resource
        //         "invaliduser", // intentionally wrong username
        //         "invalidpassword", // intentionally wrong password
        //     );
        //
        //     // Connect (should be fast due to persistent XMPP connection)
        //     await connectXMPP(newSockethubClient.socket, clientRecord.xmppJid);
        //     clientRecord.connected = true;
        //
        //     // Rejoin room
        //     await joinXMPPRoom(
        //         newSockethubClient.socket,
        //         clientRecord.xmppJid,
        //         config.prosody.room,
        //     );
        //     clientRecord.joinedRoom = true;
        //
        //     // Test that reconnected client can send messages
        //     messageLog.length = 0;
        //
        //     await sendXMPPMessage(
        //         newSockethubClient.socket,
        //         clientRecord.xmppJid,
        //         config.prosody.room,
        //         testMessage,
        //     );
        //
        //     // The client believes it is connected, but Sockethub will eventually destroy the platform
        //     // You may want to add additional assertions or logs here to observe the cleanup/crash
        //     expect(clientRecord.connected).to.be.true;
        //     expect(clientRecord.joinedRoom).to.be.true;
        // });
    });
});
