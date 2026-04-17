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

describe(`Sockethub IRC Basic Integration Tests at ${config.sockethub.url}`, () => {
    validateGlobals();

    describe("SockethubClient() — IRC", () => {
        let sc;
        const incomingMessages = [];

        // SASL tests must use the actually-registered account. Ergo's
        // bootstrap only seeds `jimmy`; SASL PLAIN for any other nick would
        // fail at the server, but `irc-socket-sasl` turns that failure into
        // a silent hang (it doesn't parse ERR_SASLFAIL / numeric 904), so
        // the test would time out without a useful error.
        const nick = config.irc.testUser.nick;
        const actorId = utils.createIrcActorId(nick);
        const actorObject = utils.createIrcActorObject(nick);

        const noAuthNick = `${config.irc.testUser.nick}NoAuth`;
        const noAuthActorId = `${noAuthNick}@${config.irc.host}`;

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

        describe("Credentials (SASL)", () => {
            it("fires an empty callback", async () => {
                await setIRCCredentials(sc, actorId, nick);
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

        describe("connect (SASL)", () => {
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

        describe("Unauthenticated (no SASL)", () => {
            it("connects without a password and without SASL", async () => {
                await setIRCCredentials(sc, noAuthActorId, noAuthNick, {
                    password: undefined,
                    sasl: false,
                });
                const msg = await connectIRC(sc, noAuthActorId, noAuthNick);
                expect(msg).to.deep.include({
                    type: "connect",
                    platform: "irc",
                });
            });
        });
    });
});
