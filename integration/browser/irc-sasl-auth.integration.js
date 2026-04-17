import { expect } from "@esm-bundle/chai";
import createTestUtils from "../utils.js";
import {
    ctx,
    emitWithAck,
    getConfig,
    validateGlobals,
} from "./shared-setup.js";

const config = getConfig();
const utils = createTestUtils(config);

// End-to-end SASL OAUTHBEARER cannot be exercised against the Ergo test
// container: Ergo does not accept OAUTHBEARER, and `irc-socket-sasl` has a
// known issue handling Ergo's server-prefixed `AUTHENTICATE +` response
// (see irc-basic.integration.js). These tests verify that the new
// credential fields (`saslMechanism`, `token`) are accepted or rejected
// correctly by the Sockethub schema validator, exercising the full
// browser → server → schema path.

describe(`Sockethub IRC SASL auth credentials at ${config.sockethub.url}`, () => {
    validateGlobals();

    describe("SASL mechanism credential validation", () => {
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
                        port: Number(config.irc.port),
                        secure: false,
                        ...object,
                    },
                },
                { label: "irc sasl-auth credentials" },
            );
        }

        it("accepts OAUTHBEARER credentials with token", async () => {
            const response = await submitCreds(
                `${config.irc.testUser.nick}OAuth`,
                {
                    token: "example-access-token",
                    saslMechanism: "OAUTHBEARER",
                },
            );
            expect(response?.error).to.be.undefined;
        });

        it("accepts PLAIN credentials with explicit saslMechanism", async () => {
            const response = await submitCreds(
                `${config.irc.testUser.nick}Plain`,
                {
                    password: "secret",
                    saslMechanism: "PLAIN",
                },
            );
            expect(response?.error).to.be.undefined;
        });

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
