if (typeof chai !== 'object') {
  chai = require('chai');
}

const assert = chai.assert;
const expect = chai.expect;

mocha.bail(true);
mocha.timeout('30s');

async function loadScript(url) {
  console.log('loadScript: ' + url);
  let response = await fetch(url);
  let script = await response.text();
  eval(script);
}



describe('Page', () => {
  it("loads socket.io.js", async () => {
    let scriptUrl = 'http://localhost:10550/socket.io.js'
    return loadScript(scriptUrl);
  });

  it("loads sockethub-client.js", async () => {
    let scriptUrl = 'http://localhost:10550/sockethub-client.js'
    return loadScript(scriptUrl);
  });

  it('has global `io`', () => {
    assert.typeOf(io, 'function');
  });

  it('has global `ASFactory`', () => {
    assert.typeOf(ASFactory, 'function');
  });

  it('has global `SockethubClient`', () => {
    assert.typeOf(SockethubClient, 'function');
  });

  describe('SockethubClient()', () => {
    let sc, handler;
    before(() => {
      sc = new SockethubClient(io('http://localhost:10550/', {path: '/sockethub'}));
    });

    describe('Dummy', () => {
      it('creates activity-object', () => {
        const actor = {
          id: "jimmy@dummy",
          type: "person",
          name: "Jimmy"
        };
        sc.ActivityStreams.Object.create(actor);
        expect(sc.ActivityStreams.Object.get(actor.id)).to.eql(actor);
      });

      let dummyMessageCount = 5;
      for (let i = 0; i < dummyMessageCount; i++) {
      it(`sends message ${i}`, (done) => {
        sc.socket.emit('message', {
          type: "echo",
          actor: "jimmy@dummy",
          context: "dummy",
          object: {type: 'message', content: `hello world ${i}`}
        }, (msg) => {
          console.log(`Dummy message ${1} callback! `, msg);
          if (msg?.error) { done(msg.error); }
          else { done(); }
        });
      });
      }
    });

    describe('Feeds', () => {
      describe('fetches a feed', () => {
        it(`gets expected results`, (done) => {
          sc.socket.emit('message', {
            context: "feeds",
            type: "fetch",
            actor: {
              type: "website",
              id: "https://sockethub.org/examples/feeds"
            },
            target: {
              type: 'feed',
              id: 'http://localhost:10550/examples/feed.xml'
            }
          }, (msg) => {
            console.log(`Feed fetch callback!`);
            expect(msg.length).to.eql(20);
            for (const m of msg) {
              expect(m.object.text.length >= m.object.brief_text.length).to.be.true;
              expect(m.object.type).to.equal('feedEntry');
              expect(m.actor.type).to.equal('feed');
              expect(m.type).to.equal('post');
            }
            done();
          });
        });
      });
    });

    describe('XMPP', () => {
      describe('emit on credentials channel', () => {
        it('successfully fires callback', (done) => {
          sc.socket.emit('credentials', {
            actor: {
              id: "jimmy@prosody/SockethubExample",
              type: 'person'
            },
            context: "xmpp",
            type: "credentials",
            object: {
              type: "credentials",
              password: "passw0rd",
              resource: "SockethubExample",
              userAddress: "jimmy@prosody"
            }
          }, (msg) => {
            console.log('XMPP credentials callback!', msg);
            if (msg?.error) { done(msg.error); }
            else {
              expect(msg.type).to.equal('credentials');
              expect(msg.object.type).to.equal('credentials');
              done();
            }
          });
        });
      });

      describe('ActivityStreams.create', () => {
        it('successfully creates and stores an activity-object', (done) => {
          const actor = {
            id: "jimmy@prosody/SockethubExample",
            type: "person",
            name: "Jimmy Userson"
          };
          const obj = sc.ActivityStreams.Object.create(actor);
          const getObj = sc.ActivityStreams.Object.get(actor.id);
          expect(obj).to.eql(actor);
          expect(getObj).to.eql(actor);
          done();
        });
      });
      

      describe('connect', () => {
        it('sends successfully with callback fired, with AS expanded', (done) => {
          const actorId = "jimmy@prosody/SockethubExample";
          sc.socket.emit('message', {
            type: "connect",
            actor: actorId,
            context: "xmpp"
          }, (msg) => {
            console.log('XMPP message callback!');
            if (msg?.error) { done(msg.error); }
            else {
              expect(msg.type).to.equal('connect');
              expect(msg.context).to.equal('xmpp');
              expect(msg.actor).to.equal(sc.ActivityStreams.Object.get(actorId));
              done();
            }
          });
        });
      });
    });
  })
});
