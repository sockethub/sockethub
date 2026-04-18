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

const CLIENT_COUNT = 5;

// Each client connects with a distinct unregistered nick (jimmy1…jimmyN)
// unauthenticated. The test container only reserves the `jimmy` account
// via bootstrap.sh, so these derivative nicks are free to claim.

describe(`IRC Multi-Client Integration Tests at ${config.sockethub.url}`, () => {
    validateGlobals();

    let records = [];
    const messageLog = [];
    const connectionLog = [];

    before(() => {
        for (let i = 1; i <= CLIENT_COUNT; i++) {
            const socket = io(config.sockethub.url, { path: "/sockethub" });
            const sockethubClient = new SockethubClient(socket);
            const nick = `${config.irc.testUser.nick}${i}`;
            const actorId = utils.createIrcActorId(nick);

            const clientRecord = {
                nick,
                actorId,
                sockethubClient,
            };

            sockethubClient.socket.on("message", (msg) => {
                messageLog.push({
                    clientId: actorId,
                    timestamp: Date.now(),
                    message: msg,
                });
            });

            records.push(clientRecord);
        }
    });

    after(() => {
        for (const clientRecord of records) {
            if (clientRecord.sockethubClient.socket.connected) {
                clientRecord.sockethubClient.socket.disconnect();
            }
        }
        records = [];
    });

    beforeEach(() => {
        messageLog.length = 0;
        connectionLog.length = 0;
    });

    describe("Concurrent Client Connections", () => {
        it("all clients can set credentials simultaneously", async () => {
            // Each unique nick gets a unique password-less credentials
            // object so they don't collide on server-side account state.
            // SASL PLAIN and OAUTHBEARER are covered in irc-sasl-auth —
            // here we want CLIENT_COUNT independent identities.
            const credentialPromises = records.map((clientRecord) =>
                setIRCCredentials(
                    clientRecord.sockethubClient,
                    clientRecord.actorId,
                    clientRecord.nick,
                ),
            );

            await Promise.all(credentialPromises);
        });

        it("all clients can connect sequentially", async () => {
            const results = [];

            for (const clientRecord of records) {
                clientRecord.sockethubClient.ActivityStreams.Object.create(
                    utils.createIrcActorObject(clientRecord.nick),
                );

                const result = await connectIRC(
                    clientRecord.sockethubClient,
                    clientRecord.actorId,
                    clientRecord.nick,
                );

                connectionLog.push({
                    clientId: clientRecord.actorId,
                    timestamp: Date.now(),
                    action: "connected",
                });
                results.push(result);
            }

            expect(results).to.have.length(CLIENT_COUNT);
        });

        it("all clients can join the test channel simultaneously", async () => {
            const joinPromises = records.map((clientRecord) =>
                joinIRCChannel(
                    clientRecord.sockethubClient,
                    clientRecord.actorId,
                    clientRecord.nick,
                    config.irc.channel,
                ).then((msg) => {
                    connectionLog.push({
                        clientId: clientRecord.actorId,
                        timestamp: Date.now(),
                        action: "joined_channel",
                    });
                    return msg;
                }),
            );

            const results = await Promise.all(joinPromises);

            expect(results).to.have.length(CLIENT_COUNT);

            // Small settle delay so every client observes every other's JOIN
            // before messages start flowing.
            await new Promise((resolve) => setTimeout(resolve, 1000));
        });
    });

    describe("Cross-Client Message Verification", () => {
        // IRC does not echo a PRIVMSG back to the sender. For a message
        // from one client, the other (CLIENT_COUNT - 1) clients should see
        // it. (Arithmetic matches the XMPP MUC assertion, structural
        // reason is different — MUC echoes, IRC doesn't.)

        it("message from client 1 is received by all other clients", async () => {
            const testMessage = `IRC test from client 1 at ${Date.now()}`;
            const sender = records[0];

            messageLog.length = 0;

            await sendIRCMessage(
                sender.sockethubClient,
                sender.actorId,
                sender.nick,
                config.irc.channel,
                testMessage,
            );

            await waitFor(
                () =>
                    messageLog.filter(
                        (log) =>
                            log.message?.object?.content === testMessage &&
                            log.message?.type === "send",
                    ).length >=
                    CLIENT_COUNT - 1,
                config.timeouts.multiClientMessage,
                50,
                () =>
                    `Received ${messageLog.filter((log) => log.message?.object?.content === testMessage).length}/${CLIENT_COUNT - 1} messages`,
            );

            const received = messageLog.filter(
                (log) =>
                    log.message?.object?.content === testMessage &&
                    log.message?.type === "send" &&
                    log.clientId !== sender.actorId,
            );

            expect(received).to.have.length.at.least(CLIENT_COUNT - 1);
        });

        it("rapid messages from multiple clients are all delivered", async () => {
            const testMessages = [];
            messageLog.length = 0;

            const sendPromises = records
                .slice(0, 3)
                .map((clientRecord, index) => {
                    const message = `Rapid IRC ${index} from ${clientRecord.nick} at ${Date.now()}`;
                    testMessages.push(message);
                    return sendIRCMessage(
                        clientRecord.sockethubClient,
                        clientRecord.actorId,
                        clientRecord.nick,
                        config.irc.channel,
                        message,
                    );
                });

            await Promise.all(sendPromises);

            await waitFor(
                () =>
                    testMessages.every((testMsg) => {
                        const received = messageLog.filter(
                            (log) =>
                                log.message?.object?.content === testMsg &&
                                log.message?.type === "send",
                        ).length;
                        return received >= CLIENT_COUNT - 1;
                    }),
                config.timeouts.multiClientMessage,
                50,
                () =>
                    testMessages
                        .map((testMsg) => {
                            const received = messageLog.filter(
                                (log) =>
                                    log.message?.object?.content === testMsg &&
                                    log.message?.type === "send",
                            ).length;
                            return `${received}/${CLIENT_COUNT - 1}`;
                        })
                        .join(", "),
            );

            for (const testMsg of testMessages) {
                const received = messageLog.filter(
                    (log) =>
                        log.message?.object?.content === testMsg &&
                        log.message?.type === "send",
                );
                expect(received).to.have.length.at.least(CLIENT_COUNT - 1);
            }
        });
    });
});
