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
        io(`http://localhost:${SH_PORT}/`, { path: "/sockethub" })
      );
      sc.socket.on("message", (msg) => {
        console.log("** incoming message: ", msg);
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

      it("sends fail and returns error", (done) => {
        let dummyObj = {
          type: "fail",
          actor: actor.id,
          context: "dummy",
          object: { type: "message", content: `failure message` },
        };
        sc.socket.emit("message", dummyObj, (msg) => {
          // console.log("dummy fail callback: ", msg);
          if (msg?.error) {
            dummyObj.error = "Error: failure message";
            dummyObj.actor = sc.ActivityStreams.Object.get(actor.id);
            expect(msg).to.eql(dummyObj);
            done();
          } else {
            done(new Error("didn't receive expected failure from dummy platform"));
          }
        });
      });

      let dummyMessageCount = 5;
      for (let i = 0; i < dummyMessageCount; i++) {
        it(`sends echo ${i} and gets response`, (done) => {
          let dummyObj = {
            type: "echo",
            actor: actor.id,
            context: "dummy",
            object: { type: "message", content: `hello world ${i}` },
          };
          sc.socket.emit("message", dummyObj, (msg) => {
            if (msg?.error) {
              done(new Error(msg.error));
            } else {
              expect(msg.target).to.eql(
                sc.ActivityStreams.Object.get(actor.id)
              );
              expect(msg.actor.type).to.equal("platform");
              done();
            }
          });
        });
      }
    });

    describe("Feeds", () => {
      describe("fetches a feed", () => {
        it(`gets expected results`, (done) => {
          sc.socket.emit(
            "message",
            {
              context: "feeds",
              type: "fetch",
              actor: {
                type: "person",
                id: "example@feeds",
              },
              target: {
                type: "feed",
                id: `http://localhost:${SH_PORT}/feed.xml`,
              },
            },
            (msg) => {
              expect(msg.length).to.eql(20);
              for (const m of msg) {
                expect(typeof m.object.content).to.equal("string");
                expect(m.object.contentType).to.equal("html");
                expect(m.actor.type).to.equal("feed");
                expect(m.type).to.equal("post");
              }
              done(msg?.error ? new Error(`Failed to fetch ${msg.target.id}: ${msg.error}`) : undefined);
            }
          );
        });
      });
    });

    describe("XMPP", () => {
      describe("emit on credentials channel", () => {
        it("fires and empty callback", (done) => {
          sc.socket.emit(
            "credentials",
            {
              actor: {
                id: "jimmy@prosody/SockethubExample",
                type: "person",
              },
              context: "xmpp",
              type: "credentials",
              object: {
                type: "credentials",
                password: "passw0rd",
                resource: "SockethubExample",
                userAddress: "jimmy@prosody",
              },
            },
            done
          );
        });
      });

      describe("ActivityStreams.create", () => {
        it("successfully creates and stores an activity-object", (done) => {
          const actor = {
            id: "jimmy@prosody/SockethubExample",
            type: "person",
            name: "Jimmy Userson",
          };
          const obj = sc.ActivityStreams.Object.create(actor);
          const getObj = sc.ActivityStreams.Object.get(actor.id);
          expect(obj).to.eql(actor);
          expect(getObj).to.eql(actor);
          done();
        });
      });

      describe("connect", () => {
        it("is successful", (done) => {
          const actorId = "jimmy@prosody/SockethubExample";
          sc.socket.emit(
            "message",
            {
              type: "connect",
              actor: actorId,
              context: "xmpp",
            },
            (msg) => {
              console.log('xmpp connect callback: ', msg);
              if (msg?.error) {
                done(new Error(msg.error));
              } else {
                expect(msg).to.eql({
                  type: "connect",
                  actor: {
                    id: actorId,
                    type: "person",
                    name: "Jimmy Userson",
                  },
                  context: "xmpp",
                });
                done();
              }
            }
          );
        });
      });
    });

    describe("Incoming Message queue", () => {
      it("should be empty", () => {
        console.log('*** INCOMING MESSAGES ***');
        console.log(incomingMessages);
        expect(incomingMessages.length).to.equal(0);
        expect(incomingMessages).to.eql([]);
      });
    });
  });
});
