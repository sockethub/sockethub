import { beforeEach, describe, expect, it } from "bun:test";
import sinon from "sinon";

import * as schemas from "@sockethub/schemas";
import parse from "@xmpp/xml/lib/parse.js";

import { IncomingHandlers } from "./incoming-handlers.js";
import { stanzas } from "./incoming-handlers.test.data.js";
import { PlatformSchema } from "./schema.js";

function makeSession(overrides = {}) {
    return {
        sendToClient: sinon.fake(),
        log: { debug: sinon.fake() },
        __knownRooms: new Set(),
        actor: undefined,
        connection: undefined,
        ...overrides,
    };
}

describe("Incoming handlers", () => {
    describe("XML stanzas result in the expected AS objects", () => {
        let ih, sendToClient;

        beforeEach(() => {
            if (!schemas.getPlatformSchema("xmpp/messages")) {
                schemas.addPlatformSchema(
                    PlatformSchema.messages,
                    "xmpp/messages",
                );
            }
            schemas.addPlatformContext("xmpp", PlatformSchema.contextUrl);
            sendToClient = sinon.fake();
            ih = new IncomingHandlers(makeSession({ sendToClient }));
        });

        stanzas.forEach(([name, stanza, asobject]) => {
            it(name, () => {
                const xmlObj = parse(stanza);
                ih.stanza(xmlObj);
                sinon.assert.calledWith(sendToClient, asobject);
            });

            it(`${name} - passes @sockethub/schemas validator`, () => {
                expect(schemas.validateActivityStream(asobject)).toEqual("");
            });
        });
    });

    describe("Room presence actor type via __knownRooms", () => {
        let ih, session;
        const ROOM_JID = "test@conference.example.org";
        const PERSON_JID = "user@example.org";

        beforeEach(() => {
            session = makeSession();
            ih = new IncomingHandlers(session);
        });

        it("presence from an unknown JID is typed as person", () => {
            const stanza = parse(
                `<presence from="${PERSON_JID}" to="me@example.org"/>`,
            );
            ih.stanza(stanza);
            sinon.assert.calledOnce(session.sendToClient);
            expect(session.sendToClient.getCall(0).args[0].actor.type).toEqual(
                "person",
            );
        });

        it("presence from a registered room JID is typed as room", () => {
            session.__knownRooms.add(ROOM_JID);
            const stanza = parse(
                `<presence from="${ROOM_JID}/Nick" to="me@example.org"/>`,
            );
            ih.stanza(stanza);
            sinon.assert.calledOnce(session.sendToClient);
            expect(session.sendToClient.getCall(0).args[0].actor.type).toEqual(
                "room",
            );
        });

        it("strips resource from JID before looking up in __knownRooms", () => {
            session.__knownRooms.add(ROOM_JID);
            // from includes a /resource portion
            const stanza = parse(
                `<presence from="${ROOM_JID}/SomeMember" to="me@example.org"/>`,
            );
            ih.stanza(stanza);
            expect(session.sendToClient.getCall(0).args[0].actor.type).toEqual(
                "room",
            );
        });

        it("presence from a JID removed from __knownRooms reverts to person", () => {
            session.__knownRooms.add(ROOM_JID);
            session.__knownRooms.delete(ROOM_JID);
            const stanza = parse(
                `<presence from="${ROOM_JID}" to="me@example.org"/>`,
            );
            ih.stanza(stanza);
            expect(session.sendToClient.getCall(0).args[0].actor.type).toEqual(
                "person",
            );
        });

        it("multiple rooms in __knownRooms are each typed correctly", () => {
            const ROOM_A = "room-a@conference.example.org";
            const ROOM_B = "room-b@conference.example.org";
            session.__knownRooms.add(ROOM_A);
            session.__knownRooms.add(ROOM_B);

            const stanzaA = parse(
                `<presence from="${ROOM_A}/Nick" to="me@example.org"/>`,
            );
            const stanzaB = parse(
                `<presence from="${ROOM_B}/Nick" to="me@example.org"/>`,
            );
            const stanzaP = parse(
                `<presence from="${PERSON_JID}" to="me@example.org"/>`,
            );

            ih.stanza(stanzaA);
            ih.stanza(stanzaB);
            ih.stanza(stanzaP);

            const calls = session.sendToClient.getCalls();
            expect(calls[0].args[0].actor.type).toEqual("room");
            expect(calls[1].args[0].actor.type).toEqual("room");
            expect(calls[2].args[0].actor.type).toEqual("person");
        });

        it("group presence from a joined room (no 'to' attr) sets actor.name from resource", () => {
            session.__knownRooms.add("speedboat@conference.xmpp.example.org");
            const stanza = parse(
                `<presence from='speedboat@conference.xmpp.example.org/user123'><show>chat</show> <status>brrroom!</status></presence>`,
            );
            ih.stanza(stanza);
            const msg = session.sendToClient.getCall(0).args[0];
            expect(msg.actor.type).toEqual("room");
            expect(msg.actor.name).toEqual("user123");
            expect(msg.object.presence).toEqual("chat");
            expect(msg.object.content).toEqual("brrroom!");
            expect(msg.target).toBeUndefined();
        });

        it("presence object has the correct structure", () => {
            session.__knownRooms.add(ROOM_JID);
            const stanza = parse(
                `<presence from="${ROOM_JID}/Nick" to="me@example.org"><show>away</show><status>Be right back</status></presence>`,
            );
            ih.stanza(stanza);
            const msg = session.sendToClient.getCall(0).args[0];
            expect(msg.type).toEqual("update");
            expect(msg.actor.type).toEqual("room");
            expect(msg.actor.id).toEqual(`${ROOM_JID}/Nick`);
            expect(msg.object.type).toEqual("presence");
            expect(msg.object.presence).toEqual("away");
            expect(msg.object.content).toEqual("Be right back");
            expect(msg.target.id).toEqual("me@example.org");
            expect(msg.target.type).toEqual("person");
        });
    });

    describe("Error handling edge cases", () => {
        it("close() should handle undefined session gracefully", () => {
            const ih = new IncomingHandlers();
            ih.session = undefined;
            expect(() => ih.close()).not.toThrow();
        });

        it("close() should handle session without actor gracefully", () => {
            const log = { debug: sinon.fake() };
            const ih = new IncomingHandlers(
                makeSession({ log, actor: undefined }),
            );
            expect(() => ih.close()).not.toThrow();
            sinon.assert.calledWith(
                log.debug,
                "received close event with no handler specified",
            );
        });

        it("close() should handle session without connection gracefully", () => {
            const ih = new IncomingHandlers(
                makeSession({ actor: { id: "test@example.com" } }),
            );
            expect(() => ih.close()).not.toThrow();
        });

        it("close() should handle session with invalid connection gracefully", () => {
            const ih = new IncomingHandlers(
                makeSession({
                    actor: { id: "test@example.com" },
                    connection: { disconnect: null },
                }),
            );
            expect(() => ih.close()).not.toThrow();
        });
    });
});
