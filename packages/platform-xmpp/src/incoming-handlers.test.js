import { beforeEach, describe, expect, it } from "bun:test";
import sinon from "sinon";

import * as schemas from "@sockethub/schemas";
import parse from "@xmpp/xml/lib/parse.js";

import { IncomingHandlers } from "./incoming-handlers.js";
import { stanzas } from "./incoming-handlers.test.data.js";
import { PlatformSchema } from "./schema.js";

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
            ih = new IncomingHandlers({
                sendToClient: sendToClient,
                log: { debug: sinon.fake() },
            });
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

    describe("Room info edge cases", () => {
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
            ih = new IncomingHandlers({
                sendToClient: sendToClient,
                log: { debug: sinon.fake() },
            });
        });

        it("ignores IQ result with non-room_info ID prefix", () => {
            const stanza = parse(
                `<iq from='room@conference.example.org' to='user@example.org' type='result' id='muc_id'>
                  <query xmlns='http://jabber.org/protocol/disco#info'>
                    <identity category='conference' type='text' name='Test'/>
                    <feature var='http://jabber.org/protocol/muc'/>
                  </query>
                </iq>`,
            );
            ih.stanza(stanza);
            const call = sendToClient.getCall(0);
            // Should be handled as room attendance, not room-info
            expect(call.args[0].type).not.toEqual("room-info");
        });

        it("ignores disco#info response with wrong xmlns", () => {
            const stanza = parse(
                `<iq from='room@conference.example.org' to='user@example.org' type='result' id='room_info_999'>
                  <query xmlns='http://jabber.org/protocol/disco#items'>
                    <item jid='room@conference.example.org/nick'/>
                  </query>
                </iq>`,
            );
            ih.stanza(stanza);
            sinon.assert.notCalled(sendToClient);
        });
    });

    describe("Error handling edge cases", () => {
        it("close() should handle undefined session gracefully", () => {
            const ih = new IncomingHandlers();
            ih.session = undefined;
            
            // This should not throw an error
            expect(() => ih.close()).not.toThrow();
        });

        it("close() should handle session without actor gracefully", () => {
            const sendToClient = sinon.fake();
            const log = {
                error: sinon.fake(),
                warn: sinon.fake(),
                info: sinon.fake(),
                debug: sinon.fake(),
            };
            
            const ih = new IncomingHandlers({
                sendToClient: sendToClient,
                log: log,
                actor: undefined,
                connection: undefined
            });
            
            // This should not throw an error
            expect(() => ih.close()).not.toThrow();
            
            // Should still call log.debug
            sinon.assert.calledWith(log.debug, "received close event with no handler specified");
        });

        it("close() should handle session without connection gracefully", () => {
            const sendToClient = sinon.fake();
            const log = {
                error: sinon.fake(),
                warn: sinon.fake(),
                info: sinon.fake(),
                debug: sinon.fake(),
            };
            
            const ih = new IncomingHandlers({
                sendToClient: sendToClient,
                log: log,
                actor: { id: "test@example.com" },
                connection: undefined
            });
            
            // This should not throw an error
            expect(() => ih.close()).not.toThrow();
        });

        it("close() should handle session with invalid connection gracefully", () => {
            const sendToClient = sinon.fake();
            const log = {
                error: sinon.fake(),
                warn: sinon.fake(),
                info: sinon.fake(),
                debug: sinon.fake(),
            };
            
            const ih = new IncomingHandlers({
                sendToClient: sendToClient,
                log: log,
                actor: { id: "test@example.com" },
                connection: { disconnect: null } // invalid disconnect method
            });
            
            // This should not throw an error
            expect(() => ih.close()).not.toThrow();
        });
    });
});
