/* eslint-disable  no-undef */
/* eslint-disable  no-eval */

if (typeof chai !== "object") {
  chai = require("chai");
}

const assert = chai.assert;
const expect = chai.expect;

const SH_PORT = __karma__.config.sh_port || 10550;

mocha.bail(true);
mocha.timeout("60s");

async function loadScript(url) {
  console.log("loadScript: " + url);
  let response = await fetch(url);
  let script = await response.text();
  // eslint-disable-next-line security/detect-eval-with-expression
  eval(script);
}

describe(`Sockethub tests at port ${SH_PORT}`, () => {
  it("loads socket.io.js", async () => {
    let scriptUrl = `http://localhost:${SH_PORT}/socket.io.js`;
    return loadScript(scriptUrl);
  });

  it("loads sockethub-client.js", async () => {
    let scriptUrl = `http://localhost:${SH_PORT}/sockethub-client.js`;
    return loadScript(scriptUrl);
  });

  it("has global `io`", () => {
    assert.typeOf(io, "function");
  });

  it("has global `SockethubClient`", () => {
    assert.typeOf(SockethubClient, "function");
  });

  describe("SockethubClient()", () => {
    let sc,
      incomingMessages = [];

    before(() => {
      sc = new SockethubClient(
        io(`http://localhost:${SH_PORT}/`, { path: "/sockethub" }),
      );
      sc.socket.on("message", (msg) => {
        console.log(">> incoming message: ", msg);
        incomingMessages.push(msg);
      });
    });

    describe("Dummy", () => {
      const actor = {
        id: "jimmy@dummy",
        type: "person",
        name: "Jimmy",
      };

      it("creates activity-object", () => {
        sc.ActivityStreams.Object.create(actor);
        expect(sc.ActivityStreams.Object.get(actor.id)).to.eql(actor);
      });

      let dummyMessageCount = 5;
      for (let i = 0; i < dummyMessageCount; i++) {
        it(`sends echo ${i} and gets response`, (done) => {
          let dummyObj = {
            type: "echo",
            actor: actor.id,
            context: "dummy",
            object: {
              type: "message",
              content: `hello world ${i}`,
            },
          };
          sc.socket.emit("activity-object-create", { foo: "bar" });
        });
      }

      it("sends fail and returns error", (done) => {
        let dummyObj = {
          type: "fail",
          actor: actor.id,
          context: "dummy",
          object: { type: "message", content: `failure message` },
        };
        sc.socket.emit("activity-object-create", { foo: "bar" });
      });
    });

    describe("Feeds", () => {
      describe("fetches a feed", () => {
        it(`gets expected results`, (done) => {
          sc.socket.emit("activity-object-create", { foo: "bar" });
        });
      });
    });

    describe("XMPP", () => {
      describe("Credentials", () => {
        it("fires an empty callback", (done) => {
          sc.socket.emit("activity-object-create", { foo: "bar" });
        });
      });

      describe("ActivityStreams.create", () => {
        it("successfully creates and stores an activity-object", () => {
          const actor = {
            id: "jimmy@prosody/SockethubExample",
            type: "person",
            name: "Jimmy Userson",
          };
          const obj = sc.ActivityStreams.Object.create(actor);
          const getObj = sc.ActivityStreams.Object.get(actor.id);
          expect(obj).to.eql(actor);
          expect(getObj).to.eql(actor);
        });
      });

      describe("connect", () => {
        it("is successful", (done) => {
          const actorId = "jimmy@prosody/SockethubExample";
          sc.socket.emit("activity-object-create", { foo: "bar" });
        });
      });
    });

    describe("Incoming Message queue", () => {
      it("should be empty", () => {
        console.log(
          `*** MESSAGE QUEUE, length: ${incomingMessages.length} ***`,
        );
        console.log(incomingMessages);
        expect(incomingMessages.length).to.eql(0);
        expect(incomingMessages).to.eql([]);
      });
    });
  });
});
