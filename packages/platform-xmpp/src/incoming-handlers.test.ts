import { beforeEach, describe, expect, test } from "bun:test";
import sinon from "sinon";

import * as schemas from "@sockethub/schemas";
import type { XmppClientInstance, XmppElement } from "@xmpp/client";
import parse from "@xmpp/xml/lib/parse.js";

import { IncomingHandlers } from "./incoming-handlers.js";
import { stanzas } from "./incoming-handlers.test.data.js";
import XMPP from "./index.js";
import { PlatformSchema } from "./schema.js";
import type { XmppHandlerSession } from "./types.js";

function makeSession(overrides: Partial<XmppHandlerSession> = {}): XmppHandlerSession {
    return {
        sendToClient: sinon.fake(),
        log: { debug: sinon.fake(), error: sinon.fake(), warn: sinon.fake(), info: sinon.fake() },
        __knownRooms: new Set(),
        actor: undefined,
        connection: undefined,
        ...overrides,
    };
}

describe("Incoming handlers", () => {
    describe("XML stanzas result in the expected AS objects", () => {
        let ih: IncomingHandlers;
        let sendToClient: ReturnType<typeof sinon.fake>;

        beforeEach(() => {
            if (!schemas.getPlatformSchema("xmpp/responses")) {
                schemas.addPlatformSchema(
                    PlatformSchema.responses,
                    "xmpp/responses",
                );
            }
            schemas.addPlatformContext("xmpp", PlatformSchema.contextUrl);
            sendToClient = sinon.fake();
            ih = new IncomingHandlers(makeSession({ sendToClient }));
        });

        stanzas.forEach(([name, stanza, asobject]) => {
            test(name, () => {
                const xmlObj = parse(
                    name === "attendance"
                        ? stanza.replace(
                            'id="muc_id"',
                            'id="attendance_00000000-0000-4000-8000-000000000000"',
                        )
                        : stanza,
                );
                ih.stanza(xmlObj);
                sinon.assert.calledWith(sendToClient, asobject);
            });

            test(`${name} - passes @sockethub/schemas validator`, () => {
                // asobjects are outbound (server -> client) messages, validated
                // against the platform's `responses` schema.
                expect(
                    schemas.validateActivityStreamResponse(
                        asobject as Parameters<
                            typeof schemas.validateActivityStreamResponse
                        >[0],
                    ),
                ).toEqual("");
            });
        });
    });

    describe("Room info edge cases", () => {
        let ih: IncomingHandlers;
        let sendToClient: ReturnType<typeof sinon.fake>;

        beforeEach(() => {
            if (!schemas.getPlatformSchema("xmpp/responses")) {
                schemas.addPlatformSchema(
                    PlatformSchema.responses,
                    "xmpp/responses",
                );
            }
            schemas.addPlatformContext("xmpp", PlatformSchema.contextUrl);
            sendToClient = sinon.fake();
            ih = new IncomingHandlers({
                sendToClient: sendToClient,
                log: { debug: sinon.fake(), error: sinon.fake(), warn: sinon.fake(), info: sinon.fake() },
                __knownRooms: new Set(),
            });
        });

        test("handles IQ error response for room-info query", () => {
            const stanza = parse(
                `<iq from='noroom@conference.example.org' to='user@example.org' type='error' id='room_info_err1'>
                  <error type='cancel'><item-not-found xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/></error>
                </iq>`,
            );
            ih.stanza(stanza);
            sinon.assert.calledOnce(sendToClient);
            const arg = sendToClient.getCall(0).args[0];
            expect(arg.type).toEqual("query");
            expect(arg.object.type).toEqual("room-info");
            expect(arg.error).toBeDefined();
            expect(arg.actor.id).toEqual("noroom@conference.example.org");
        });

        test("routes IQ result with attendance ID prefix to attendance", () => {
            const stanza = parse(
                `<iq from='room@conference.example.org' to='user@example.org' type='result' id='attendance_999'>
                  <query xmlns='http://jabber.org/protocol/disco#info'>
                    <identity category='conference' type='text' name='Test'/>
                    <feature var='http://jabber.org/protocol/muc'/>
                  </query>
                </iq>`,
            );
            ih.stanza(stanza);
            sinon.assert.calledOnce(sendToClient);
            const arg = sendToClient.getCall(0).args[0];
            expect(arg.type).toEqual("query");
            expect(arg.object.type).toEqual("attendance");
        });

        test("does not route old or unrelated IQ IDs to attendance", () => {
            const oldIdStanza = parse(
                `<iq from='room@conference.example.org' to='user@example.org' type='result' id='muc_id'>
                  <query xmlns='http://jabber.org/protocol/disco#items'>
                    <item jid='room@conference.example.org/nick' name='nick'/>
                  </query>
                </iq>`,
            );
            const unrelatedIdStanza = parse(
                `<iq from='room@conference.example.org' to='user@example.org' type='result' id='room_members_1'>
                  <query xmlns='http://jabber.org/protocol/disco#items'>
                    <item jid='room@conference.example.org/nick' name='nick'/>
                  </query>
                </iq>`,
            );

            ih.stanza(oldIdStanza);
            ih.stanza(unrelatedIdStanza);

            sinon.assert.calledTwice(sendToClient);
            for (const call of sendToClient.getCalls()) {
                expect(call.args[0].object?.type).not.toEqual("attendance");
            }
        });

        test("sends error response for disco#info result with wrong xmlns", () => {
            const stanza = parse(
                `<iq from='room@conference.example.org' to='user@example.org' type='result' id='room_info_999'>
                  <query xmlns='http://jabber.org/protocol/disco#items'>
                    <item jid='room@conference.example.org/nick'/>
                  </query>
                </iq>`,
            );
            ih.stanza(stanza);
            sinon.assert.calledOnce(sendToClient);
            const arg = sendToClient.getCall(0).args[0];
            expect(arg.type).toEqual("query");
            expect(arg.object.type).toEqual("room-info");
            expect(arg.error).toBeDefined();
        });

        test("groups fields without 'muc#' prefix or underscore into 'custom'", () => {
            const stanza = parse(
                `<iq from='room@conference.example.org' to='user@example.org' type='result' id='room_info_custom'>
                  <query xmlns='http://jabber.org/protocol/disco#info'>
                    <x type='result' xmlns='jabber:x:data'>
                      <field var='some_custom_key' type='text-single' label='Custom Key'>
                        <value>custom_val</value>
                      </field>
                      <field var='flatkey' type='text-single' label='Flat Key'>
                        <value>flat_val</value>
                      </field>
                    </x>
                  </query>
                </iq>`,
            );
            ih.stanza(stanza);
            sinon.assert.calledOnce(sendToClient);
            const arg = sendToClient.getCall(0).args[0];
            expect(arg.type).toEqual("query");
            expect(arg.object.custom).toBeDefined();
            expect(arg.object.custom.some_custom_key).toEqual({
                type: "text-single",
                label: "Custom Key",
                value: "custom_val",
            });
            expect(arg.object.custom.flatkey).toEqual({
                type: "text-single",
                label: "Flat Key",
                value: "flat_val",
            });
        });
    });

    describe("Attendance query IDs", () => {
        test("uses distinct attendance IDs and routes matching responses", async () => {
            const send = sinon.fake.resolves();
            const xmlFake = sinon.fake(
                (
                    name: string,
                    attrs?: Record<string, string | undefined>,
                    ...children: XmppElement[]
                ) => ({ name, attrs, children }) as unknown as XmppElement,
            );

            class TestXMPP extends XMPP {
                protected createXml(): void {
                    this.__xml = xmlFake as unknown as typeof this.__xml;
                }
            }

            const xp = new TestXMPP({
                id: "user@example.org",
                log: { debug: sinon.fake(), error: sinon.fake(), warn: sinon.fake(), info: sinon.fake() },
                sendToClient: sinon.fake(),
                updateActor: sinon.fake.resolves(),
            });
            xp.__client = {
                send,
            } as unknown as XmppClientInstance;

            const job = {
                actor: {
                    id: "user@example.org",
                    type: "person",
                },
                target: {
                    id: "room@conference.example.org",
                    type: "room",
                },
                object: {
                    type: "attendance",
                },
            };

            await new Promise<void>((resolve, reject) => {
                xp.query(job as never, (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });
            await new Promise<void>((resolve, reject) => {
                xp.query(job as never, (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });

            const firstId = send.getCall(0).args[0].attrs.id;
            const secondId = send.getCall(1).args[0].attrs.id;

            expect(firstId).toMatch(/^attendance_/);
            expect(secondId).toMatch(/^attendance_/);
            expect(firstId).not.toEqual(secondId);

            const sendToClient = sinon.fake();
            const ih = new IncomingHandlers(makeSession({ sendToClient }));
            ih.stanza(
                parse(
                    `<iq from='room@conference.example.org' to='user@example.org' type='result' id='${firstId}'>
                      <query xmlns='http://jabber.org/protocol/disco#items'>
                        <item jid='room@conference.example.org/one' name='one'/>
                      </query>
                    </iq>`,
                ),
            );
            ih.stanza(
                parse(
                    `<iq from='room@conference.example.org' to='user@example.org' type='result' id='${secondId}'>
                      <query xmlns='http://jabber.org/protocol/disco#items'>
                        <item jid='room@conference.example.org/two' name='two'/>
                      </query>
                    </iq>`,
                ),
            );

            sinon.assert.calledTwice(sendToClient);
            expect(sendToClient.getCall(0).args[0].object.members).toEqual(["one"]);
            expect(sendToClient.getCall(1).args[0].object.members).toEqual(["two"]);
        });
    });

    describe("Room presence actor type via __knownRooms", () => {
        let ih: IncomingHandlers;
        let session: XmppHandlerSession;
        const ROOM_JID = "test@conference.example.org";
        const PERSON_JID = "user@example.org";

        beforeEach(() => {
            session = makeSession();
            ih = new IncomingHandlers(session);
        });

        test("presence from an unknown JID is typed as person", () => {
            const stanza = parse(
                `<presence from="${PERSON_JID}" to="me@example.org"/>`,
            );
            ih.stanza(stanza);
            sinon.assert.calledOnce(session.sendToClient as ReturnType<typeof sinon.fake>);
            expect((session.sendToClient as ReturnType<typeof sinon.fake>).getCall(0).args[0].actor.type).toEqual(
                "person",
            );
        });

        test("presence from a registered room JID is typed as room", () => {
            session.__knownRooms.add(ROOM_JID);
            const stanza = parse(
                `<presence from="${ROOM_JID}/Nick" to="me@example.org"/>`,
            );
            ih.stanza(stanza);
            sinon.assert.calledOnce(session.sendToClient as ReturnType<typeof sinon.fake>);
            expect((session.sendToClient as ReturnType<typeof sinon.fake>).getCall(0).args[0].actor.type).toEqual(
                "room",
            );
        });

        test("strips resource from JID before looking up in __knownRooms", () => {
            session.__knownRooms.add(ROOM_JID);
            const stanza = parse(
                `<presence from="${ROOM_JID}/SomeMember" to="me@example.org"/>`,
            );
            ih.stanza(stanza);
            expect((session.sendToClient as ReturnType<typeof sinon.fake>).getCall(0).args[0].actor.type).toEqual(
                "room",
            );
        });

        test("presence from a JID removed from __knownRooms reverts to person", () => {
            session.__knownRooms.add(ROOM_JID);
            session.__knownRooms.delete(ROOM_JID);
            const stanza = parse(
                `<presence from="${ROOM_JID}" to="me@example.org"/>`,
            );
            ih.stanza(stanza);
            expect((session.sendToClient as ReturnType<typeof sinon.fake>).getCall(0).args[0].actor.type).toEqual(
                "person",
            );
        });

        test("multiple rooms in __knownRooms are each typed correctly", () => {
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

            const calls = (session.sendToClient as ReturnType<typeof sinon.fake>).getCalls();
            expect(calls[0].args[0].actor.type).toEqual("room");
            expect(calls[1].args[0].actor.type).toEqual("room");
            expect(calls[2].args[0].actor.type).toEqual("person");
        });

        test("group presence from a joined room (no 'to' attr) sets actor.name from resource", () => {
            session.__knownRooms.add("speedboat@conference.xmpp.example.org");
            const stanza = parse(
                `<presence from='speedboat@conference.xmpp.example.org/user123'><show>chat</show> <status>brrroom!</status></presence>`,
            );
            ih.stanza(stanza);
            const msg = (session.sendToClient as ReturnType<typeof sinon.fake>).getCall(0).args[0];
            expect(msg.actor.type).toEqual("room");
            expect(msg.actor.name).toEqual("user123");
            expect(msg.object.presence).toEqual("chat");
            expect(msg.object.content).toEqual("brrroom!");
            expect(msg.target).toBeUndefined();
        });

        test("presence object has the correct structure", () => {
            session.__knownRooms.add(ROOM_JID);
            const stanza = parse(
                `<presence from="${ROOM_JID}/Nick" to="me@example.org"><show>away</show><status>Be right back</status></presence>`,
            );
            ih.stanza(stanza);
            const msg = (session.sendToClient as ReturnType<typeof sinon.fake>).getCall(0).args[0];
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
        test("close() should handle undefined session gracefully", () => {
            const ih = new IncomingHandlers();
            ih.session = undefined;
            expect(() => ih.close()).not.toThrow();
        });

        test("close() should handle session without actor gracefully", () => {
            const log = { debug: sinon.fake(), error: sinon.fake(), warn: sinon.fake(), info: sinon.fake() };
            const ih = new IncomingHandlers(
                makeSession({ log, actor: undefined }),
            );
            expect(() => ih.close()).not.toThrow();
            sinon.assert.calledWith(
                log.debug,
                "received close event with no handler specified",
            );
        });

        test("close() should handle session without connection gracefully", () => {
            const ih = new IncomingHandlers(
                makeSession({ actor: { id: "test@example.com", type: "person" } }),
            );
            expect(() => ih.close()).not.toThrow();
        });

        test("close() should handle session with invalid connection gracefully", () => {
            const ih = new IncomingHandlers(
                makeSession({
                    actor: { id: "test@example.com", type: "person" },
                    connection: { disconnect: undefined },
                }),
            );
            expect(() => ih.close()).not.toThrow();
        });
    });
});
