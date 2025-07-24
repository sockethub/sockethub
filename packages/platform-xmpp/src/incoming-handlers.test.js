import { beforeEach, describe, expect, it } from "bun:test";
import sinon from "sinon";

import * as schemas from "@sockethub/schemas";
import parse from "@xmpp/xml/lib/parse.js";

import { IncomingHandlers } from "./incoming-handlers.js";
import { stanzas } from "./incoming-handlers.test.data.js";

describe("Incoming handlers", () => {
    describe("XML stanzas result in the expected AS objects", () => {
        let ih, sendToClient;

        beforeEach(() => {
            sendToClient = sinon.fake();
            ih = new IncomingHandlers({
                sendToClient: sendToClient,
                debug: sinon.fake(),
                __xml: () => ({}),
                __client: {
                    sendReceive: sinon.fake.rejects(new Error('Service discovery not available in tests'))
                }
            });
            
            // Mock determineActorType for testing
            ih.determineActorType = sinon.fake(async (jid) => {
                // Simple heuristic for tests: if JID contains 'room' or 'chat', it's a room
                const bareJid = jid.split('/')[0];
                return bareJid.includes('room') || bareJid.includes('chat') ? 'room' : 'person';
            });
        });

        stanzas.forEach(([name, stanza, asobject]) => {
            it(name, async () => {
                const xmlObj = parse(stanza);
                await ih.stanza(xmlObj);
                
                // Wait a bit for async operations to complete
                await new Promise(resolve => setTimeout(resolve, 10));
                
                sinon.assert.calledWith(sendToClient, asobject);
            });

            it(`${name} - passes @sockethub/schemas validator`, () => {
                expect(schemas.validateActivityStream(asobject)).toEqual("");
            });
        });
    });
});
