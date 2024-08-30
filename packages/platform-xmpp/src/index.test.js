import "https://deno.land/x/deno_mocha/global.ts";
import { assertEquals } from "jsr:@std/assert";
import { assertSpyCallArg, assertSpyCalls, spy } from "jsr:@std/testing/mock";
import XMPP from "./index.js";

import { actor, credentials, job, target } from "./index.data.test.js";

let startResolution = true;
async function resolveConnection() {
  if (startResolution) {
    return Promise.resolve();
  } else {
    return Promise.reject("mocked rejection");
  }
}

let sendCount = 0;
let xmlCount = 0;

describe("Platform", () => {
  let xmlSpy, sendSpy, startSpy, joinSpy, xp, sendToClientSpy;

  beforeEach(() => {
    startResolution = true;
    const clientObject = {
      on: () => {},
      start: resolveConnection,
      send: async (_msg) => {
        console.log("send called: ", _msg);
        return Promise.resolve();
      },
      join: async () => Promise.resolve(),
    };
    startSpy = spy(clientObject, "start");
    sendSpy = spy(clientObject, "send");
    joinSpy = spy(clientObject, "join");
    xmlSpy = spy();

    class TestXMPP extends XMPP {
      createClient() {
        this.__clientConstructor = () => {
          return clientObject;
        };
      }
      createXml() {
        this.__xml = xmlSpy;
      }
    }
    const sessionMock = {
      id: actor,
      debug: (_msg) => {
        console.log("debug: ", _msg);
      },
      sendToClient: (_msg) => {
        console.log("*** sendToClient called: ", _msg);
      },
    };
    sendToClientSpy = spy(sessionMock, "sendToClient");
    xp = new TestXMPP(sessionMock);
  });

  afterEach(() => {
    sendSpy.restore();
    startSpy.restore();
    sendToClientSpy.restore();
  });

  describe("Successful initialization", () => {
    it("works as intended", () => {
      return new Promise((resolve) => {
        xp.connect(job.connect, credentials, () => {
          assertEquals(typeof xp.__client.on, "function");
          assertEquals(typeof xp.__client.start, "function");
          assertEquals(typeof xp.__client.send, "function");
          assertEquals(typeof xp.__client.join, "function");
          assertSpyCalls(sendSpy, 0);
          assertSpyCalls(startSpy, 1);
          assertSpyCalls(sendToClientSpy, 0);
          resolve();
        });
      });
    });
  });

  describe("Bad initialization", () => {
    it("returns the existing __client object", () => {
      return new Promise((resolve) => {
        xp.__client = "foo";
        xp.connect(job.connect, credentials, () => {
          assertEquals(xp.__client, "foo");
          assertSpyCalls(startSpy, 0);
          assertSpyCalls(sendToClientSpy, 0);
          resolve();
        });
      });
    });

    it("deletes the __client property on failed connect", () => {
      return new Promise((resolve) => {
        xp.__client = undefined;
        startResolution = false;
        xp.connect(job.connect, credentials, (_err) => {
          assertEquals(_err, "mocked rejection");
          assertSpyCalls(sendToClientSpy, 0);
          assertSpyCalls(startSpy, 1);
          assertEquals(xp.__client, undefined);
          resolve();
        });
      });
    });
  });

  describe("Platform functionality", () => {
    beforeEach(() => {
      return new Promise((resolve, reject) => {
        xp.connect(job.join, credentials, (_err) => {
          assertEquals(!!xp.__client, true, "xmpp client object not set");
          resolve();
        });
      });
    });

    describe("#join", () => {
      it("calls xmpp.js correctly", () => {
        return new Promise((resolve) => {
          xp.join(job.join, () => {
            assertSpyCalls(sendSpy, ++sendCount);
            assertSpyCallArg(xmlSpy, xmlCount, 0, "presence");
            assertSpyCallArg(xmlSpy, xmlCount, 1, {
              from: "testingham@jabber.net",
              to: "partyroom@jabber.net/testing ham",
            });
            resolve();
          });
        });
      });
    });

    describe("#join2", () => {
      it("calls xmpp.js correctly", () => {
        return new Promise((resolve) => {
          xp.join(job.join, () => {
            assertSpyCalls(sendSpy, ++sendCount);
            xmlCount++;
            assertSpyCallArg(xmlSpy, xmlCount, 0, "presence");
            assertSpyCallArg(xmlSpy, xmlCount, 1, {
              from: "testingham@jabber.net",
              to: "partyroom@jabber.net/testing ham",
            });
            resolve();
          });
        });
      });
    });

    describe("#leave", () => {
      it("calls xmpp.js correctly", () => {
        return new Promise((resolve) => {
          xp.leave(job.leave, () => {
            assertSpyCalls(sendSpy, ++sendCount);
            xmlCount++;
            assertSpyCallArg(xmlSpy, xmlCount, 0, "presence");
            assertSpyCallArg(xmlSpy, xmlCount, 1, {
              from: "testingham@jabber.net",
              to: "partyroom@jabber.net/testing ham",
              type: "unavailable",
            });
            resolve();
          });
        });
      });
    });

    describe("#send", () => {
      it("calls xmpp.js correctly", () => {
        return new Promise((resolve) => {
          xp.send(job.send.chat, () => {
            assertSpyCalls(sendSpy, ++sendCount);

            xmlCount++;
            assertSpyCallArg(xmlSpy, xmlCount, 0, "body");
            assertSpyCallArg(xmlSpy, xmlCount, 1, {});
            assertSpyCallArg(xmlSpy, xmlCount, 2, job.send.chat.object.content);

            xmlCount++;
            assertSpyCallArg(xmlSpy, xmlCount, 0, "message");
            assertSpyCallArg(xmlSpy, xmlCount, 1, {
              type: "chat",
              to: job.send.chat.target.id,
              id: job.send.chat.object.id,
            });
            assertSpyCallArg(xmlSpy, xmlCount, 2, undefined);
            assertSpyCallArg(xmlSpy, xmlCount, 3, undefined);
            resolve();
          });
        });
      });

      it("calls xmpp.js correctly for a group chat", () => {
        return new Promise((resolve) => {
          xp.send(job.send.groupchat, () => {
            assertSpyCalls(sendSpy, ++sendCount);

            xmlCount++;
            assertSpyCallArg(xmlSpy, xmlCount, 0, "body");
            assertSpyCallArg(xmlSpy, xmlCount, 1, {});
            assertSpyCallArg(
              xmlSpy,
              xmlCount,
              2,
              job.send.groupchat.object.content,
            );

            xmlCount++;
            assertSpyCallArg(xmlSpy, xmlCount, 0, "message");
            assertSpyCallArg(xmlSpy, xmlCount, 1, {
              type: "groupchat",
              to: job.send.groupchat.target.id,
              id: job.send.groupchat.object.id,
            });
            assertSpyCallArg(xmlSpy, xmlCount, 2, undefined);
            assertSpyCallArg(xmlSpy, xmlCount, 3, undefined);
            resolve();
          });
        });
      });

      it("calls xmpp.js correctly for a message correction", () => {
        return new Promise((resolve) => {
          xp.send(job.send.correction, () => {
            assertSpyCalls(sendSpy, ++sendCount);

            xmlCount++;
            assertSpyCallArg(xmlSpy, xmlCount, 0, "body");
            assertSpyCallArg(xmlSpy, xmlCount, 1, {});
            assertSpyCallArg(
              xmlSpy,
              xmlCount,
              2,
              job.send.correction.object.content,
            );

            xmlCount++;
            assertSpyCallArg(xmlSpy, xmlCount, 0, "replace");
            assertSpyCallArg(xmlSpy, xmlCount, 1, {
              id: job.send.correction.object["xmpp:replace"].id,
              xmlns: "urn:xmpp:message-correct:0",
            });

            xmlCount++;
            assertSpyCallArg(xmlSpy, xmlCount, 0, "message");
            assertSpyCallArg(xmlSpy, xmlCount, 1, {
              type: "groupchat",
              to: job.send.correction.target.id,
              id: job.send.correction.object.id,
            });
            assertSpyCallArg(xmlSpy, xmlCount, 2, undefined);
            assertSpyCallArg(xmlSpy, xmlCount, 3, undefined);
            resolve();
          });
        });
      });
    });

    describe("#update", () => {
      it("calls xml() correctly for available", () => {
        return new Promise((resolve) => {
          xp.update(job.update.presenceOnline, () => {
            assertSpyCalls(sendSpy, ++sendCount);
            xmlCount++;
            assertSpyCallArg(xmlSpy, xmlCount, 0, "presence");
            assertSpyCallArg(xmlSpy, xmlCount, 1, {});
            assertSpyCallArg(xmlSpy, xmlCount, 2, {});
            assertSpyCallArg(xmlSpy, xmlCount, 3, { status: "ready to chat" });
            resolve();
          });
        });
      });

      it("calls xml() correctly for unavailable", () => {
        return new Promise((resolve) => {
          xp.update(job.update.presenceUnavailable, () => {
            assertSpyCalls(sendSpy, ++sendCount);
            xmlCount++;
            assertSpyCallArg(xmlSpy, xmlCount, 0, "presence");
            assertSpyCallArg(xmlSpy, xmlCount, 1, {});
            assertSpyCallArg(xmlSpy, xmlCount, 2, { show: "away" });
            assertSpyCallArg(xmlSpy, xmlCount, 3, { status: "eating popcorn" });
            resolve();
          });
        });
      });

      it("calls xml() correctly for offline", () => {
        return new Promise((resolve) => {
          xp.update(job.update.presenceOffline, () => {
            assertSpyCalls(sendSpy, ++sendCount);
            xmlCount++;
            assertSpyCallArg(xmlSpy, xmlCount, 0, "presence");
            assertSpyCallArg(xmlSpy, xmlCount, 1, { type: "unavailable" });
            assertSpyCallArg(xmlSpy, xmlCount, 2, {});
            assertSpyCallArg(xmlSpy, xmlCount, 3, {});
            resolve();
          });
        });
      });
    });

    describe("#request-friend", () => {
      it("calls xmpp.js correctly", () => {
        return new Promise((resolve) => {
          xp["request-friend"](job["request-friend"], () => {
            assertSpyCalls(sendSpy, ++sendCount);
            xmlCount++;
            assertSpyCallArg(xmlSpy, xmlCount, 0, "presence");
            assertSpyCallArg(xmlSpy, xmlCount, 1, {
              type: "subscribe",
              to: job["request-friend"].target["id"],
            });
            resolve();
          });
        });
      });
    });

    describe("#remove-friend", () => {
      it("calls xmpp.js correctly", () => {
        return new Promise((resolve) => {
          xp["remove-friend"](job["remove-friend"], () => {
            assertSpyCalls(sendSpy, ++sendCount);
            xmlCount++;
            assertSpyCallArg(xmlSpy, xmlCount, 0, "presence");
            assertSpyCallArg(xmlSpy, xmlCount, 1, {
              type: "unsubscribe",
              to: job["remove-friend"].target["id"],
            });
            resolve();
          });
        });
      });
    });

    describe("#make-friend", () => {
      it("calls xmpp.js correctly", (done) => {
        return new Promise((resolve) => {
          xp["remove-friend"](job["remove-friend"], () => {
            assertSpyCalls(sendSpy, ++sendCount);
            xmlCount++;
            assertSpyCallArg(xmlSpy, xmlCount, 0, "presence");
            assertSpyCallArg(xmlSpy, xmlCount, 1, {
              type: "unsubscribe",
              to: job["make-friend"].target["id"],
            });
            resolve();
          });
        });
      });
    });

    describe("#query", () => {
      it("calls xmpp.js correctly", (done) => {
        return new Promise((resolve) => {
          xp.query(job.query, () => {
            assertSpyCalls(sendSpy, ++sendCount);
            xmlCount++;
            assertSpyCallArg(xmlSpy, xmlCount, 0, "query");
            assertSpyCallArg(xmlSpy, xmlCount, 1, {
              xmlns: "http://jabber.org/protocol/disco#items",
            });
            xmlCount++;
            assertSpyCallArg(xmlSpy, xmlCount, 0, "iq");
            assertSpyCallArg(xmlSpy, xmlCount, 1, {
              id: "muc_id",
              type: "get",
              from: "testingham@jabber.net",
              to: "partyroom@jabber.net",
            });
            assertSpyCallArg(xmlSpy, xmlCount, 2, undefined);
            resolve();
          });
        });
      });
    });
  });
});
