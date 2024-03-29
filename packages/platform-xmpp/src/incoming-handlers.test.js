const sinon = require("sinon");
const chai = require("chai");
const expect = chai.expect;

const parse = require("@xmpp/xml/lib/parse");
const schemas = require("@sockethub/schemas").default;

const IncomingHandler = require("./incoming-handlers");
const stanzas = require("./incoming-handlers.test.data");

describe("Incoming handlers", () => {
    describe("XML stanzas result in the expected AS objects", () => {
        let ih, sendToClient;

        beforeEach(() => {
            sendToClient = sinon.fake();
            ih = new IncomingHandler({
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
                expect(schemas.validateActivityStream(asobject)).to.equal("");
            });
        });
    });
});
