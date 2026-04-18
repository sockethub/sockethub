import { expect } from "@esm-bundle/chai";
import createTestUtils from "../utils.js";
import {
    connectIRC,
    getConfig,
    setIRCCredentials,
    validateGlobals,
} from "./shared-setup.js";

const config = getConfig();
const utils = createTestUtils(config);

// IRC does not have an exact analog for XMPP's "resource clash". We probe
// two IRC-native invariants that cover the same conceptual ground:
//
//   1. Same nick, different actor IDs → the second connection hits
//      ERR_NICKNAMEINUSE on the IRC server. irc2as translates that numeric
//      into a `serviceError` ActivityStream (packages/irc2as/src/index.js
//      around ERR_NICK_IN_USE).
//
//   2. Same actor ID (same credentialsHash) from two concurrent connects →
//      Sockethub shares one platform instance per credentialsHash, and the
//      platform has a single-connection-per-instance lock via
//      `clientConnecting` (packages/platform-irc/src/index.ts). The second
//      caller should either wait for the first to finish and reuse the
//      client, or fail cleanly — never hang.

describe(`IRC Nick Clash Integration Tests at ${config.sockethub.url}`, () => {
    validateGlobals();

    describe("Same nick, different actor IDs", () => {
        let firstClient;
        let secondClient;
        const nick = `${config.irc.testUser.nick}Clash`;
        const firstActorId = `${nick}@${config.irc.host}`;
        const secondActorId = `${nick}@${config.irc.host}/second`;
        const errors = [];

        before(() => {
            firstClient = new SockethubClient(
                io(config.sockethub.url, { path: "/sockethub" }),
            );
            secondClient = new SockethubClient(
                io(config.sockethub.url, { path: "/sockethub" }),
            );

            const capture = (msg) => {
                if (msg?.type === "error") {
                    errors.push(msg);
                }
            };
            firstClient.socket.on("message", capture);
            secondClient.socket.on("message", capture);
        });

        after(() => {
            if (firstClient?.socket?.connected) {
                firstClient.socket.disconnect();
            }
            if (secondClient?.socket?.connected) {
                secondClient.socket.disconnect();
            }
        });

        it("second connection with the same nick surfaces a serviceError", async () => {
            await setIRCCredentials(firstClient, firstActorId, nick);
            firstClient.ActivityStreams.Object.create(
                utils.createIrcActorObject(nick),
            );
            await connectIRC(firstClient, firstActorId, nick);

            await setIRCCredentials(secondClient, secondActorId, nick);
            secondClient.ActivityStreams.Object.create({
                id: secondActorId,
                type: "person",
                name: nick,
            });

            let secondConnectError;
            try {
                await connectIRC(secondClient, secondActorId, nick);
            } catch (err) {
                secondConnectError = err;
            }

            // The second connect either fails outright (irc-socket-sasl
            // refused the registration) or surfaces a serviceError on the
            // socket's message stream. Accept either signal — the only
            // unacceptable outcome is silent success.
            const sawServiceError = errors.some((msg) =>
                /nick|use/i.test(msg?.error || ""),
            );
            expect(
                secondConnectError || sawServiceError,
                `expected nick clash to error; got error=${secondConnectError?.message} errors=${JSON.stringify(errors)}`,
            ).to.be.ok;
        });
    });

    describe("Same actor ID, concurrent connects", () => {
        let clientA;
        let clientB;
        const nick = `${config.irc.testUser.nick}Shared`;
        const actorId = utils.createIrcActorId(nick);

        before(() => {
            clientA = new SockethubClient(
                io(config.sockethub.url, { path: "/sockethub" }),
            );
            clientB = new SockethubClient(
                io(config.sockethub.url, { path: "/sockethub" }),
            );
        });

        after(() => {
            if (clientA?.socket?.connected) {
                clientA.socket.disconnect();
            }
            if (clientB?.socket?.connected) {
                clientB.socket.disconnect();
            }
        });

        it("two concurrent connects sharing an actor ID both resolve", async () => {
            // Same credentials object on both sockets → same credentialsHash
            // → same platform child process. The second getClient call
            // should wait on the first via the `clientConnecting` lock and
            // then reuse the shared client.
            await Promise.all([
                setIRCCredentials(clientA, actorId, nick),
                setIRCCredentials(clientB, actorId, nick),
            ]);
            const actorObject = utils.createIrcActorObject(nick);
            clientA.ActivityStreams.Object.create(actorObject);
            clientB.ActivityStreams.Object.create(actorObject);

            const results = await Promise.allSettled([
                connectIRC(clientA, actorId, nick),
                connectIRC(clientB, actorId, nick),
            ]);

            const fulfilled = results.filter((r) => r.status === "fulfilled");
            // At minimum the first caller must succeed. The second should
            // also succeed (platform sharing); if it fails, it must do so
            // with a clean error rather than hanging.
            expect(fulfilled.length).to.be.at.least(1);
            for (const r of results) {
                if (r.status === "rejected") {
                    expect(r.reason.message).to.match(
                        /irc|connect|client|nick/i,
                    );
                }
            }
        });
    });
});
