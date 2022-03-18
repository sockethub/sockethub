if (typeof chai !== 'object') {
  chai = require('chai');
}

const assert = chai.assert;
const expect = chai.expect;

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

  let genHandler = function (done) {
    return function (msg) {
      if (msg && msg.error) {
        console.log("ERROR: ", msg.error);
        done(msg.error);
      } else {
        done();
      }
    }
  }

  describe('new SockethubClient()', () => {
    let sc;

    before(() => {
      sc = new SockethubClient(io('http://localhost:10550/', { path: '/sockethub' }));
    });

    it('send credentials', (done) => {
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
      }, genHandler(done));
    }).timeout(3000);

    it('`create activity-object', () => {
      const actor = {
        id: "jimmy@prosody/SockethubExample",
        type: "person",
        name: "Jimmy Userson"
      };
      sc.ActivityStreams.Object.create(actor);
      expect(sc.ActivityStreams.Object.get(actor.id)).to.eql(actor);
    });

    it('send connect', (done) => {
      sc.socket.emit('message', {
        type: "connect",
        actor: "jimmy@prosody/SockethubExample",
        context: "xmpp"
      }, genHandler(done));
    }).timeout(12000);
  });
});
