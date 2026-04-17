import { expect } from "@esm-bundle/chai";
import createTestUtils from "../utils.js";
import {
    connectIRC,
    getConfig,
    joinIRCChannel,
    sendIRCMessage,
    setIRCCredentials,
    validateGlobals,
} from "./shared-setup.js";

const config = getConfig();
const utils = createTestUtils(config);

// SASL is intentionally not exercised here. `irc-socket-sasl` does not
// handle server-prefixed `AUTHENTICATE +` responses (Ergo sends
// `:ergo.test AUTHENTICATE +`), so the client never sends its base64
// PLAIN payload and the handshake stalls until the Sockethub connect
// timeout fires. The non-SASL path is the realistic default for public
// IRC networks and exercises the full connect → join → send flow.

describe(`Sockethub IRC Basic Integration Tests at ${config.sockethub.url}`, () => {
    validateGlobals();

    describe("SockethubClient() — IRC", () => {
        let sc;
        const incomingMessages = [];

        const nick = `${config.irc.testUser.nick}Basic`;
        const actorId = utils.createIrcActorId(nick);
        const actorObject = utils.createIrcActorObject(nick);

        before(async () => {
            sc = new SockethubClient(
                io(config.sockethub.url, { path: "/sockethub" }),
            );
            sc.socket.on("message", (msg) => {
                incomingMessages.push(msg);
            });
            await sc.ready();
        });

        after(() => {
            if (sc?.socket) {
                sc.socket.disconnect();
            }
        });

        describe("Credentials", () => {
            it("fires an empty callback", async () => {
                await setIRCCredentials(sc, actorId, nick, {
                    password: undefined,
                    sasl: false,
                });
            });
        });

        describe("ActivityStreams.create", () => {
            it("successfully creates and stores an activity-object", () => {
                const obj = sc.ActivityStreams.Object.create(actorObject);
                const getObj = sc.ActivityStreams.Object.get(actorObject.id);
                expect(obj).to.eql(actorObject);
                expect(getObj).to.eql(actorObject);
            });
        });

        describe("connect", () => {
            it("is successful", async () => {
                const msg = await connectIRC(sc, actorId, nick);
                expect(msg).to.deep.include({
                    type: "connect",
                    platform: "irc",
                });
                expect(msg.actor).to.deep.include({
                    id: actorObject.id,
                    type: actorObject.type,
                });
            });
        });

        describe("Join", () => {
            it("should be successful", async () => {
                const msg = await joinIRCChannel(
                    sc,
                    actorId,
                    nick,
                    config.irc.channel,
                );
                expect(msg).to.deep.include({
                    type: "join",
                    platform: "irc",
                });
                expect(msg.target).to.deep.include({
                    id: config.irc.channel,
                    type: "room",
                });
            });
        });

        describe("Send", () => {
            it("should be successful", async () => {
                const content = "Hello from Sockethub IRC!";
                const msg = await sendIRCMessage(
                    sc,
                    actorId,
                    nick,
                    config.irc.channel,
                    content,
                );
                expect(msg).to.deep.include({
                    type: "send",
                    platform: "irc",
                });
                expect(msg.object).to.deep.include({
                    type: "message",
                    content,
                });
                expect(msg.target).to.deep.include({
                    id: config.irc.channel,
                    type: "room",
                });
            });

            // IRC servers do not echo PRIVMSG back to the sender, so we expect
            // no incoming echo for our own send. XMPP MUC does echo — this is
            // a structural difference, not a bug.
            it("does not receive its own PRIVMSG echo", async () => {
                await new Promise((resolve) =>
                    setTimeout(resolve, config.timeouts.message),
                );
                const echoes = incomingMessages.filter(
                    (m) =>
                        m.type === "send" &&
                        m.platform === "irc" &&
                        m.actor?.id === actorObject.id,
                );
                expect(echoes).to.have.length(0);
            });
        });
    });
});
