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

  describe('new SockethubClient()', () => {
    let sc;
    const genHandler = function (done) {
      return function (msg) {
        console.log('CALLBACK HANDLER CALLED for: ', msg);
        if (msg && msg.error) {
          console.log("ERROR: ", msg.error);
          done(msg.error);
        } else {
          done();
        }
      }
    };

    before(() => {
      sc = new SockethubClient(io('http://localhost:10550/', { path: '/sockethub' }));
    });

    describe('create activity-object', () => {
      it('results in a fetch-able actor object', () =>  {
        const actor = {
          id: "jimmy@prosody/SockethubExample",
          type: "person",
          name: "Jimmy Userson"
        };
        sc.ActivityStreams.Object.create(actor);
        expect(sc.ActivityStreams.Object.get(actor.id)).to.eql(actor);
      });

      it('can send connect with actor string', (done) => {
        sc.socket.emit('message', {
          type: "echo",
          actor: "jimmy@prosody/SockethubExample",
          context: "dummy",
          object: {type: 'message', content: 'hello world'}
        }, genHandler(done));
      }).timeout(2000);
    });
  });
});
