import { expect } from "@esm-bundle/chai";
import createTestUtils from "../utils.js";
import {
    connectIRC,
    getConfig,
    joinIRCChannel,
    sendIRCMessage,
    setIRCCredentials,
    validateGlobals,
    waitFor,
} from "./shared-setup.js";

const config = getConfig();
const utils = createTestUtils(config);

describe("IRC Client Reconnection Tests", () => {
    const messages = new Map();
    const connect = new Map();
    const connectError = new Map();

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
            m.push({ timestamp: Date.now(), message: msg });
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

            const nick = `${config.irc.testUser.nick}Rejoin`;
            const actorId = utils.createIrcActorId(nick);

            try {
                initialClient = connectSockethubClient();
                await setIRCCredentials(initialClient, actorId, nick);
                initialClient.ActivityStreams.Object.create(
                    utils.createIrcActorObject(nick),
                );
                await connectIRC(initialClient, actorId, nick);
                await joinIRCChannel(
                    initialClient,
                    actorId,
                    nick,
                    config.irc.channel,
                );
                expect(connect.get(initialClient.socket.id)).to.be.true;
                expect(connectError.get(initialClient.socket.id)).to.not.be
                    .true;

                await sendIRCMessage(
                    initialClient,
                    actorId,
                    nick,
                    config.irc.channel,
                    "Hello world",
                );

                if (initialClient.socket.connected) {
                    initialClient.socket.disconnect();
                }

                await new Promise((resolve) =>
                    setTimeout(resolve, config.timeouts.process),
                );

                reconnectedClient = connectSockethubClient();

                await waitFor(
                    () => reconnectedClient.socket.connected,
                    config.timeouts.connect,
                );

                await setIRCCredentials(reconnectedClient, actorId, nick);
                reconnectedClient.ActivityStreams.Object.create(
                    utils.createIrcActorObject(nick),
                );
                await connectIRC(reconnectedClient, actorId, nick);
                await joinIRCChannel(
                    reconnectedClient,
                    actorId,
                    nick,
                    config.irc.channel,
                );

                await sendIRCMessage(
                    reconnectedClient,
                    actorId,
                    nick,
                    config.irc.channel,
                    "Reconnection test message",
                );

                await new Promise((resolve) =>
                    setTimeout(resolve, config.timeouts.message),
                );

                expect(initialClient.socket.connected).to.be.false;
                expect(reconnectedClient.socket.connected).to.be.true;
            } finally {
                if (reconnectedClient?.socket?.connected) {
                    reconnectedClient.socket.disconnect();
                }
            }
        });

        // SASL PLAIN against Ergo is proven to work in
        // irc-sasl-auth.integration.js. This test deliberately sends wrong
        // credentials and verifies the platform cleans up (no zombie child
        // processes or stuck connections).
        it("reconnection with wrong SASL creds causes proper platform cleanup (no zombie processes)", async () => {
            let initialClient;
            let invalidCredClient;
            let validCredClient;

            const nick = `${config.irc.testUser.nick}SaslCleanup`;
            const actorId = utils.createIrcActorId(nick);
            // The bootstrap-registered `jimmy` account is the one whose password
            // is meaningful. Reuse its actor identity for this cleanup test so
            // "wrong password" is actually a wrong password.
            const saslNick = config.irc.testUser.nick;
            const saslActorId = utils.createIrcActorId(`${saslNick}BadPw`);

            try {
                initialClient = connectSockethubClient();
                await setIRCCredentials(initialClient, actorId, nick);
                initialClient.ActivityStreams.Object.create(
                    utils.createIrcActorObject(nick),
                );
                await connectIRC(initialClient, actorId, nick);
                await joinIRCChannel(
                    initialClient,
                    actorId,
                    nick,
                    config.irc.channel,
                );

                initialClient.socket.disconnect();
                await new Promise((resolve) =>
                    setTimeout(resolve, config.timeouts.process),
                );

                invalidCredClient = connectSockethubClient();
                await waitFor(
                    () => invalidCredClient.socket.connected,
                    config.timeouts.connect,
                );

                // SASL with a wrong password against the real `jimmy` account
                // should fail at SASL time and force-disconnect the platform.
                await setIRCCredentials(
                    invalidCredClient,
                    saslActorId,
                    saslNick,
                    {
                        password: "wrong-password-for-jimmy",
                    },
                );

                let connectFailed = false;
                try {
                    await connectIRC(invalidCredClient, saslActorId, saslNick);
                } catch (err) {
                    connectFailed = true;
                    // `irc-socket-sasl` surfaces SASL failures via the connect
                    // response as "unable to connect to server: ...". Accept
                    // any authentication-flavored wording the server returns.
                    expect(err.message).to.match(
                        /sasl|authentication|unable to connect|close/i,
                    );
                }
                expect(connectFailed).to.be.true;

                await new Promise((resolve) =>
                    setTimeout(resolve, config.timeouts.cleanup),
                );

                // Fresh client with unauthenticated creds — a failure here
                // would mean the server is in a bad state post-SASL-failure
                // (zombie platform processes, stuck connections, etc.).
                validCredClient = connectSockethubClient();
                await waitFor(
                    () => validCredClient.socket.connected,
                    config.timeouts.connect,
                );

                const freshNick = `${config.irc.testUser.nick}Fresh`;
                const freshActorId = utils.createIrcActorId(freshNick);
                await setIRCCredentials(
                    validCredClient,
                    freshActorId,
                    freshNick,
                );
                validCredClient.ActivityStreams.Object.create(
                    utils.createIrcActorObject(freshNick),
                );
                await connectIRC(validCredClient, freshActorId, freshNick);
            } finally {
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
