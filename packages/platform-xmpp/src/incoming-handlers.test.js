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
                log: { debug: sinon.fake() },
                __xml: () => ({}),
                __client: {
                    sendReceive: sinon.fake.rejects(new Error('Service discovery not available in tests'))
                }
            });
            
            // Mock determineActorType for testing - matches production heuristic
            ih.determineActorType = sinon.fake(async (jid) => {
                // Use same heuristic as production fallback
                const bareJid = jid.split('/')[0];
                return bareJid.includes('conference.') || bareJid.includes('muc.') || bareJid.includes('chat.') ? 'room' : 'person';
            });
        });

        stanzas.forEach(([name, stanza, asobject]) => {
            it(name, async () => {
                const xmlObj = parse(stanza);
                await ih.stanza(xmlObj);
                
                sinon.assert.calledWith(sendToClient, asobject);
            });

            it(`${name} - passes @sockethub/schemas validator`, () => {
                expect(schemas.validateActivityStream(asobject)).toEqual("");
            });
        });
    });

    describe("Actor type determination", () => {
        let ih, mockSession;

        beforeEach(() => {
            mockSession = {
                debug: sinon.fake(),
                __xml: sinon.fake(),
                __client: {
                    sendReceive: sinon.stub()
                }
            };
            ih = new IncomingHandlers(mockSession);
        });

        it("should identify room via MUC feature in service discovery", async () => {
            const mockResponse = {
                getChild: sinon.fake.returns({
                    getChildren: sinon.fake((type) => {
                        if (type === 'feature') {
                            return [{ attrs: { var: 'http://jabber.org/protocol/muc' } }];
                        }
                        return [];
                    })
                })
            };
            mockSession.__client.sendReceive.resolves(mockResponse);

            const result = await ih.determineActorType('room@conference.example.org/user');
            expect(result).toBe('room');
        });

        it("should identify room via conference identity in service discovery", async () => {
            const mockResponse = {
                getChild: sinon.fake.returns({
                    getChildren: sinon.fake((type) => {
                        if (type === 'feature') {
                            return [];
                        } else if (type === 'identity') {
                            return [{ attrs: { category: 'conference' } }];
                        }
                        return [];
                    })
                })
            };
            mockSession.__client.sendReceive.resolves(mockResponse);

            const result = await ih.determineActorType('chatroom@muc.example.org');
            expect(result).toBe('room');
        });

        it("should default to person when service discovery finds no room indicators", async () => {
            const mockResponse = {
                getChild: sinon.fake.returns({
                    getChildren: sinon.fake(() => [])
                })
            };
            mockSession.__client.sendReceive.resolves(mockResponse);

            const result = await ih.determineActorType('user@example.org');
            expect(result).toBe('person');
        });

        it("should fall back to heuristic when service discovery fails", async () => {
            mockSession.__client.sendReceive.rejects(new Error('Service discovery timeout'));

            const roomResult = await ih.determineActorType('test@conference.example.org');
            expect(roomResult).toBe('room');

            const personResult = await ih.determineActorType('user@example.org');
            expect(personResult).toBe('person');
        });

        it("should cache results to avoid repeated queries", async () => {
            const mockResponse = {
                getChild: sinon.fake.returns({
                    getChildren: sinon.fake(() => [{ attrs: { var: 'http://jabber.org/protocol/muc' } }])
                })
            };
            mockSession.__client.sendReceive.resolves(mockResponse);

            // First call
            await ih.determineActorType('room@conference.example.org/user1');
            // Second call with different resource should use cache
            await ih.determineActorType('room@conference.example.org/user2');

            // Service discovery should only be called once due to caching
            sinon.assert.calledOnce(mockSession.__client.sendReceive);
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
