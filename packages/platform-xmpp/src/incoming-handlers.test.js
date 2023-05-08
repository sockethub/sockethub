import sinon from "sinon";
import {expect} from "chai";
import parse from "@xmpp/xml/lib/parse.js";

import schemas from "@sockethub/schemas";

import IncomingHandler from "./incoming-handlers.js";
import stanzas from "./incoming-handlers.test.data.js";

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

      it(`${name} - passes @sockethub/schemas validator`, () => {
        expect(schemas.default.validateActivityStream(asobject)).to.equal("");
      });
    });
  });
});
