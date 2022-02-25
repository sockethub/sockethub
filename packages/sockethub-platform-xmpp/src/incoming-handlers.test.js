const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;
const IncomingHandler = require('./incoming-handlers');
const parse = require('@xmpp/xml/lib/parse');
const schemas = require('sockethub-schemas');

const stanzas = require('./incoming-handlers.data');
const {os} = require("yarn/lib/cli");

describe('Incoming handlers', () => {
  describe('XML stanzas result in the expected AS objects', () => {
    let ih, sendToClient;

    beforeEach(() => {
      sendToClient = sinon.fake();
      ih = new IncomingHandler({
        sendToClient: sendToClient,
        debug: sinon.fake()
      });
    });

    stanzas.forEach(([name, stanza, asobject]) => {
      it(name, () => {
        const xmlObj = parse(stanza);
        ih.stanza(xmlObj);
        sinon.assert.calledWith(sendToClient, asobject);
      });

      it(`${name} - passes sockethub-schemas validator`, () => {
        expect(schemas.validator.validateActivityStream(asobject)).to.equal("");
      })
    });
  });
});
