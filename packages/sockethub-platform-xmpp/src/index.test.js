const proxyquire = require('proxyquire');
const chai = require('chai');
const sinon = require('sinon');
const expect = chai.expect;

proxyquire.noPreserveCache();
proxyquire.noCallThru()

const actor = {
  '@type': 'person',
  '@id': 'testingham@jabber.net',
  displayName:'testing ham'
};

const credentials = {
  actor: actor,
  object: {
    '@type': 'credentials',
    username: 'testingham',
    server: 'jabber.net',
    password: 'foobar',
    resource: 'home'
  }
};

const target = {
  mrfoobar: {
    '@type': 'person',
    '@id': 'mrfoobar@jabber.net',
    displayName: 'Mr FooBar'
  },
  partyroom: {
    '@type': 'room',
    '@id': 'partyroom@jabber.net'
  },
  roomuser: {
    '@type': 'room',
    '@id': 'partyroom@jabber.net/ms tut'
  }
};

const job = {
  join: {
    actor: actor,
    object: {
      '@type': 'update',
      displayName: 'Frank'
    },
    target: target.partyroom
  },
  send: {
    chat: {
      actor: actor,
      object: {
        '@type': 'message',
        content: 'hello'
      },
      target: target.mrfoobar
    },
    groupchat: {
      actor: actor,
      object: {
        '@type': 'message',
        content: 'hello'
      },
      target: target.roomuser
    }
  },
  update: {
    presence: {
      actor: actor,
      object: {
        '@type': 'presence',
        presence: 'available',
        status: 'available'
      }
    }
  },
  'request-friend': {
    actor: actor,
    target: target.mrfoobar
  },
  'remove-friend': {
    actor: actor,
    target: target.mrfoobar
  },
  'make-friend': {
    actor: actor,
    target: target.mrfoobar
  },
  observe: {
    actor: actor,
    target: target.partyroom,
    object: {
      '@type': 'attendance'
    }
  }
};

describe('initial loaded properties', () => {
  let shXmpp, clientFake, xmlFake, clientObjectFake, xp;

  beforeEach(() => {
    clientObjectFake = {
      on: sinon.fake(),
      start: sinon.fake.resolves(),
      send: sinon.fake.resolves(),
      join: sinon.fake.resolves(),
    }
    clientFake = sinon.fake.returns(clientObjectFake);
    xmlFake = sinon.fake();

    shXmpp = proxyquire('./index', {
      '@xmpp/client': {
        client: clientFake,
        xml: xmlFake
      },
      './utils': {
        buildXmppCredentials: sinon.fake()
      }
    });

    xp = new shXmpp({
      id: actor,
      debug: sinon.fake(),
      sendToClient: sinon.fake()
    });
  });

  afterEach(() => {
    sinon.restore();
  })

  describe('bad initialization', () => {

    it('existing __client object is returned',   (done) => {
      xp.__client = 'foo';
      xp.connect(job.join, credentials, () => {
        expect(xp.__client).to.equal('foo');
        sinon.assert.notCalled(clientFake);
        sinon.assert.notCalled(xp.sendToClient);
        // sinon.assert.calledOnce(clientFake);
        // sinon.assert.calledOnce(xp.sendToClient);
        done();
      });
    });

    it('failed connect will delete the __client property', (done) => {
      clientObjectFake.start = sinon.fake.rejects('foo');
      xp.connect(job.join, credentials, () => {
        expect(xp.__client).to.be.undefined;
        sinon.assert.calledOnce(xp.sendToClient);
        done();
      });
    });
  });

  describe('xmpp platform initialization', () => {

    beforeEach((done) => {
      xp.connect(job.join, credentials, () => {
        sinon.assert.calledOnce(clientFake);
        expect(xp.__client.on).to.exist;
        expect(xp.__client.start).to.exist;
        expect(xp.__client.send).to.exist;
        sinon.assert.calledOnce(clientObjectFake.start);
        sinon.assert.notCalled(xp.sendToClient);
        done();
      });
    });

    it('calls xmpp.js correctly when #join is called', (done) => {
      expect(xp.__client).to.not.be.undefined;
      xp.join(job.join, () => {
        sinon.assert.calledOnce(xp.__client.send);
        sinon.assert.calledWith(xmlFake,
          "presence", {"from": "testingham@jabber.net", "to": "partyroom@jabber.net/testing ham"});
        done();
      });
    });

    it('calls xmpp.js correctly when #send is called', (done) => {
      const message = xmlFake(
        "message",
        {type: job.send.chat.target['@type'] === 'room' ? 'groupchat' : 'chat',
          to: job.send.chat.target['@id']},
        xmlFake("body", {}, job.send.chat.object.content),
      );
      xp.send(job.send.chat, () => {
        sinon.assert.calledWith(xp.__client.send, message);
        done();
      });
    });

    it('calls xmpp.js correctly when #send is called for a groupchat', (done) => {
      const message = xmlFake(
        "message",
        {type: job.send.chat.target['@type'] === 'room' ? 'groupchat' : 'chat',
          to: job.send.chat.target['@id']},
        xmlFake("body", {}, job.send.chat.object.content),
      );
      xp.send(job.send.groupchat, () => {
        sinon.assert.calledWith(xp.__client.send, message);
        done();
      });
    });

    it('calls xmpp.js correctly when #update is called', (done) => {
      xp.update(job.update.presence, () => {
        sinon.assert.calledOnce(xp.__client.send);
        sinon.assert.calledWith(xp.__client.send, xmlFake("presence", { type: "available" }));
        done();
      });
    });

    it('calls xmpp.js correctly when #request-friend is called', (done) => {
      xp['request-friend'](job['request-friend'], () => {
        sinon.assert.calledOnce(xp.__client.send);
        sinon.assert.calledWith(xp.__client.send,
          xmlFake("presence", { type: "subscribe", to: job['request-friend'].target['@id'] }));
        done();
      });
    });

    it('calls xmpp.js correctly when #remove-friend is called', (done) => {
      xp['remove-friend'](job['remove-friend'], () => {
        sinon.assert.calledOnce(xp.__client.send);
        sinon.assert.calledWith(xp.__client.send,
          xmlFake("presence", { type: "subscribe", to: job['remove-friend'].target['@id'] }));
        done();
      });
    });

    it('calls xmpp.js correctly when #make-friend is called', (done) => {
      xp['remove-friend'](job['remove-friend'], () => {
        sinon.assert.calledOnce(xp.__client.send);
        sinon.assert.calledWith(xp.__client.send,
          xmlFake("presence", { type: "subscribe", to: job['make-friend'].target['@id'] }));
        done();
      });
    });

    it('calls xmpp.js correctly when #observe is called', (done) => {
      xp.observe(job.observe, () => {
        sinon.assert.calledOnce(xp.__client.send);
        sinon.assert.calledWith(xp.__client.send,
          xmlFake("iq",  {
            id: 'muc_id',
            type: 'get',
            from: "testingham@jabber.net",
            to: "partyroom@jabber.net/testing ham"
          }, xmlFake("query", {xmlns: 'http://jabber.org/protocol/disco#items'})));
        done();
      });
    });
  });
});
