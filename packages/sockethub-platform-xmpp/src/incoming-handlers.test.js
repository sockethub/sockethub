const sinon = require('sinon');
const IncomingHandler = require('./incoming-handlers');
const parse = require('@xmpp/xml/lib/parse');

const stanzas = require('./incoming-handlers.data')

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
    });
  });
});
