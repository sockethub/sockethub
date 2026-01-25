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
