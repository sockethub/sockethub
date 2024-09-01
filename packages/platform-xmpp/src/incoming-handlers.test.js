import "https://deno.land/x/deno_mocha/global.ts";
import { assertEquals } from "jsr:@std/assert";
import { assertSpyCallArg, spy } from "jsr:@std/testing/mock";

import xml from "@xmpp/xml";
import schemas from "@sockethub/schemas";

import IncomingHandler from "./incoming-handlers.js";
import { stanzas } from "./incoming-handlers.data.test.js";

// taken from
// https://raw.githubusercontent.com/xmppjs/xmpp.js/main/packages/xml/lib/parse.js
function parse(data) {
  const p = new xml.Parser();

  let result = null;
  let error = null;

  p.on("start", (el) => {
    result = el;
  });
  p.on("element", (el) => {
    result.append(el);
  });
  p.on("error", (err) => {
    error = err;
  });

  p.write(data);
  p.end();

  if (error) {
    throw error;
  } else {
    return result;
  }
}

describe("Incoming handlers", () => {
  describe("XML stanzas result in the expected AS objects", () => {
    let ih, sendToClient;

    beforeEach(() => {
      sendToClient = spy();
      ih = new IncomingHandler({
        sendToClient: sendToClient,
        debug: spy(),
      });
    });

    stanzas.forEach(([name, stanza, asobject]) => {
      it(name, () => {
        const xmlObj = parse(stanza);
        ih.stanza(xmlObj);
        assertSpyCallArg(sendToClient, 0, 0, asobject);
      });

      it(`${name} - passes @sockethub/schemas validator`, () => {
        assertEquals(schemas.validateActivityStream(asobject), "");
      });
    });
  });
});
