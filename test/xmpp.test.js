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

describe('integration page', () => {

  it("must load socket.io.js", async () => {
    let scriptUrl = 'http://localhost:10550/socket.io.js'
    return loadScript(scriptUrl);
  });

  it("must load sockethub-client.js", async () => {
    let scriptUrl = 'http://localhost:10550/sockethub-client.js'
    return loadScript(scriptUrl);
  });

  it('has expected global io', () => {
    assert.typeOf(io, 'function');
  });

  it('has expected global ASFactory', () => {
    assert.typeOf(ASFactory, 'function');
  });

  it('has expected global SockethubClient', () => {
    assert.typeOf(SockethubClient, 'function');
  });

  let genHandler = function (done) {
    return function (msg) {
      if (msg && msg.error) { done(msg.error); }
      else { done(); }
    }
  }

  describe('with an initialized SockethubClient', () => {
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
          port: 5222,
          resource: "SockethubExample",
          server: "prosody",
          username: "jimmy"
          // TODO FIXME: create test to verify setting credentials without server property
          //  eg. username: jimmy@prosody
        }
      }, genHandler(done));
    }).timeout(3000);

    it('send connect', (done) => {
      sc.socket.emit('message', {
        type: "connect",
        actor: {
          id: "jimmy@prosody/SockethubExample",
          type: "person"
        },
        context: "xmpp"
      }, genHandler(done));
    });
  });
});