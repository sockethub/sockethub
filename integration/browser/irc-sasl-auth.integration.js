import { expect } from "@esm-bundle/chai";
import createTestUtils from "../utils.js";
import {
    connectIRC,
    ctx,
    emitWithAck,
    getConfig,
    joinIRCChannel,
    partIRCChannel,
    platformIdFromContext,
    sendIRCMessage,
    setIRCCredentials,
    validateGlobals,
} from "./shared-setup.js";

const config = getConfig();
const utils = createTestUtils(config);

// Full-path SASL tests exercising both PLAIN (password) and OAUTHBEARER
// (token) against the Ergo test container. OAUTHBEARER is validated via
// the `mock-oauth` service (accounts.oauth2.introspection-url in
// ircd.yaml) with autocreate enabled.

describe(`Sockethub IRC SASL auth at ${config.sockethub.url}`, () => {
    validateGlobals();

    // Each mechanism runs a full connect → join → send → leave flow using
    // a dedicated client. `after` disconnects so the next describe block
    // can reuse the jimmy account without collision.
    function runAuthFlow(label, credentialOverrides, nick) {
        describe(label, () => {
            let sc;
            const actorId = utils.createIrcActorId(nick);

            before(async () => {
                sc = new SockethubClient(
                    io(config.sockethub.url, { path: "/sockethub" }),
                );
                await sc.ready();
            });

            after(() => {
                if (sc?.socket) {
                    sc.socket.disconnect();
                }
            });

            it("accepts credentials", async () => {
                await setIRCCredentials(sc, actorId, nick, credentialOverrides);
            });

            it("connects successfully", async () => {
                const msg = await connectIRC(sc, actorId, nick);
                expect(msg.type).to.equal("connect");
                expect(platformIdFromContext(msg["@context"])).to.equal("irc");
                expect(msg.actor?.id).to.equal(actorId);
            });

            it("joins the test channel", async () => {
                const msg = await joinIRCChannel(
                    sc,
                    actorId,
                    nick,
                    config.irc.channel,
                );
                expect(msg.type).to.equal("join");
                expect(platformIdFromContext(msg["@context"])).to.equal("irc");
                expect(msg.target?.id).to.equal(config.irc.channel);
            });

            it("sends a message to the channel", async () => {
                const content = `hello from ${label}`;
                const msg = await sendIRCMessage(
                    sc,
                    actorId,
                    nick,
                    config.irc.channel,
                    content,
                );
                expect(msg.type).to.equal("send");
                expect(platformIdFromContext(msg["@context"])).to.equal("irc");
                expect(msg.object?.content).to.equal(content);
            });

            it("parts the channel", async () => {
                const msg = await partIRCChannel(
                    sc,
                    actorId,
                    nick,
                    config.irc.channel,
                );
                expect(msg.type).to.equal("leave");
                expect(platformIdFromContext(msg["@context"])).to.equal("irc");
            });
        });
    }

    runAuthFlow(
        "SASL PLAIN (password)",
        { password: config.irc.testUser.password },
        config.irc.testUser.nick,
    );

    // Ergo will autocreate `oauthuser` (the username returned by the mock
    // introspection endpoint) on first valid token presentation. The nick
    // must match the account name because Ergo is configured with
    // nick-reservation: strict.
    runAuthFlow(
        "SASL OAUTHBEARER (token)",
        {
            token: config.irc.testUser.oauthToken,
            saslMechanism: "OAUTHBEARER",
        },
        "oauthuser",
    );

    describe("schema validation", () => {
        let sc;

        before(async () => {
            sc = new SockethubClient(
                io(config.sockethub.url, { path: "/sockethub" }),
            );
            await sc.ready();
        });

        after(() => {
            if (sc?.socket) {
                sc.socket.disconnect();
            }
        });

        function submitCreds(nick, object) {
            const actorId = utils.createIrcActorId(nick);
            return emitWithAck(
                sc.socket,
                "credentials",
                {
                    actor: { id: actorId, type: "person", name: nick },
                    "@context": ctx("irc"),
                    type: "credentials",
                    object: {
                        type: "credentials",
                        nick,
                        server: config.irc.host,
                        port: config.irc.port,
                        secure: false,
                        ...object,
                    },
                },
                { label: "irc sasl-auth credentials" },
            );
        }

        it("rejects credentials that set both password and token", async () => {
            const response = await submitCreds(
                `${config.irc.testUser.nick}Both`,
                {
                    password: "secret",
                    token: "example-access-token",
                },
            );
            expect(response?.error).to.be.a("string");
        });

        it("rejects unknown saslMechanism values", async () => {
            const response = await submitCreds(
                `${config.irc.testUser.nick}Bad`,
                {
                    saslMechanism: "SCRAM-SHA-256",
                },
            );
            expect(response?.error).to.be.a("string");
        });
    });
});
