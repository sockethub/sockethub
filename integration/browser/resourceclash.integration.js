import { expect } from "@esm-bundle/chai";
import createTestUtils from "../utils.js";
import {
    connectXMPP,
    getConfig,
    setXMPPCredentials,
    validateGlobals,
} from "./shared-setup.js";

const config = getConfig();
const utils = createTestUtils(config);

const CLIENT_COUNT = 2;

// sending a unique actor ID (two xmpp platforms spawn) but a resource property
// in the credentials that was the same, caused a disconnect/connect/reconnect
// feedback loop in sockethub between the two platforms.
//
// e.g.
//       sending credentials:  {
//         actor: { id: 'jimmy@localhost/SockethubTest1', type: 'person' },
//         context: 'xmpp',
//         type: 'credentials',
//         object: {
//           type: 'credentials',
//           password: 'passw0rd',
//           resource: 'SockethubTest',
//           userAddress: 'jimmy@localhost',
//           server: 'xmpp://localhost:5222'
//         }
//       }
//       sending credentials:  {
//         actor: { id: 'jimmy@localhost/SockethubTest2', type: 'person' },
//         context: 'xmpp',
//         type: 'credentials',
//         object: {
//           type: 'credentials',
//           password: 'passw0rd',
//           resource: 'SockethubTest',
//           userAddress: 'jimmy@localhost',
//           server: 'xmpp://localhost:5222'
//         }
//       }

// all clients get the same resource, but their jids will intentionally have different resources.
const resource = "TheSameResource";

describe(`XMPP Resource Clash Integration Tests at ${config.sockethub.url}`, () => {
    validateGlobals();

    let records = [];
    const connectionLog = [];
    const errors = [];

    before(() => {
        for (let i = 1; i <= CLIENT_COUNT; i++) {
            const socket = io(config.sockethub.url, { path: "/sockethub" });
            const sockethubClient = new SockethubClient(socket);
            const clientRecord = {
                resource: resource,
                jid: utils.createXmppJid(`${resource}${i}`),
                sockethubClient: sockethubClient,
            };

            sockethubClient.socket.on("message", (msg) => {
                console.log("received message", msg);
                if (msg.type === "error") {
                    errors.push({
                        jid: msg.actor.id,
                        message: msg.error,
                    });
                }
            });

            records.push(clientRecord);
        }
    });

    after(() => {
        // Cleanup all clients
        for (const clientRecord of records) {
            if (clientRecord.sockethubClient.socket.connected) {
                clientRecord.sockethubClient.socket.disconnect();
            }
        }
        records = [];
    });

    beforeEach(() => {
        connectionLog.length = 0;
    });

    describe("Concurrent Client Connections", () => {
        it("all clients can set credentials simultaneously", async () => {
            const credentialPromises = records.map((clientRecord) =>
                setXMPPCredentials(
                    clientRecord.sockethubClient,
                    clientRecord.jid, // unique jid for same user, e.g. jimmy@prosody/TheSameResource1,2,3
                    resource, // TheSameResource
                ),
            );

            await Promise.all(credentialPromises);
        });

        it("all clients can connect sequentially", async () => {
            for (const clientRecord of records) {
                // Create activity object first
                clientRecord.sockethubClient.ActivityStreams.Object.create(
                    utils.createActorObject(clientRecord.jid),
                );

                await connectXMPP(
                    clientRecord.sockethubClient,
                    clientRecord.jid,
                );

                if (clientRecord.sockethubClient.connected) {
                    console.log(`${clientRecord.jid} connected`);
                    connectionLog.push({
                        clientId: clientRecord.jid,
                        timestamp: Date.now(),
                        action: "connected",
                    });
                }
            }

            return new Promise((resolve) => {
                // Verify all clients connected successfully
                expect(connectionLog).to.have.length(CLIENT_COUNT);
                expect(errors).to.have.length(1);
                resolve();
            });
        });
    });
});
