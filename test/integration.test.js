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

      it('sends message', (done) => {
        sc.socket.emit('message', {
          type: "echo",
          actor: "jimmy@dummy",
          context: "dummy",
          object: {type: 'message', content: 'hello world'}
        }, (msg) => {
          console.log('Dummy message callback! ', msg);
          if (msg?.error) { done(msg.error); }
          else { done(); }
        });
      });
    });

    describe('XMPP', () => {
      it('sends credentials', (done) => {
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
          console.log('XMPP credentials callback! ', msg);
          if (msg?.error) { done(msg.error); }
          else { done(); }
        });
      });

      it('creates activity-object', (id, expand) => {
        const actor = {
          id: "jimmy@prosody/SockethubExample",
          type: "person",
          name: "Jimmy Userson"
        };
        sc.ActivityStreams.Object.create(actor);
        expect(sc.ActivityStreams.Object.get(actor.id)).to.eql(actor);
      });

      it('sends connect', (done) => {
        sc.socket.emit('message', {
          type: "connect",
          actor: "jimmy@prosody/SockethubExample",
          context: "xmpp"
        }, (msg) => {
          console.log('XMPP message callback! ', msg);
          if (msg?.error) { done(msg.error); }
          else { done(); }
        });
      });
    });
  })
});
