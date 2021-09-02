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
  leave: {
    actor: actor,
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

describe('Platform', () => {
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

  describe('Successful initialization', () => {
    it('works as intended', (done) => {
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
  });

  describe('Bad initialization', () => {
    it('returns the existing __client object',   (done) => {
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

    it('deletes the __client property on failed connect', (done) => {
      clientObjectFake.start = sinon.fake.rejects('foo');
      xp.connect(job.join, credentials, () => {
        expect(xp.__client).to.be.undefined;
        sinon.assert.notCalled(xp.sendToClient);
        done();
      });
    });
  });

  describe('Platform functionality', () => {
    beforeEach(done => {
      xp.connect(job.join, credentials, () => done());
    });

    describe('#join', () => {
      it('calls xmpp.js correctly', (done) => {
        expect(xp.__client).to.not.be.undefined;
        xp.join(job.join, () => {
          sinon.assert.calledOnce(xp.__client.send);
          sinon.assert.calledWith(xmlFake, "presence", {
            "from": "testingham@jabber.net",
            "to": "partyroom@jabber.net/testing ham"
          });
          done();
        });
      });
    });

    describe('#leave', () => {
      it('calls xmpp.js correctly', (done) => {
        expect(xp.__client).to.not.be.undefined;
        xp.leave(job.leave, () => {
          sinon.assert.calledOnce(xp.__client.send);
          sinon.assert.calledWith(xmlFake, "presence", {
            "from": "testingham@jabber.net",
            "to": "partyroom@jabber.net/testing ham",
            "type": "unavailable"
          });
          done();
        });
      });
    });

    describe('#send', () => {
      it('calls xmpp.js correctly', (done) => {
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

      it('calls xmpp.js correctly when called for a groupchat', (done) => {
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
    })

    describe('#update', () => {
      it('calls xmpp.js correctly', (done) => {
        xp.update(job.update.presence, () => {
          sinon.assert.calledOnce(xp.__client.send);
          sinon.assert.calledWith(xp.__client.send, xmlFake("presence", { type: "available" }));
          done();
        });
      });
    });

    describe('#request-friend', () => {
      it('calls xmpp.js correctly', (done) => {
        xp['request-friend'](job['request-friend'], () => {
          sinon.assert.calledOnce(xp.__client.send);
          sinon.assert.calledWith(xp.__client.send,
            xmlFake("presence", { type: "subscribe", to: job['request-friend'].target['@id'] }));
          done();
        });
      });
    });

    describe('#remove-friend', () => {
      it('calls xmpp.js correctly', (done) => {
        xp['remove-friend'](job['remove-friend'], () => {
          sinon.assert.calledOnce(xp.__client.send);
          sinon.assert.calledWith(xp.__client.send,
            xmlFake("presence", { type: "subscribe", to: job['remove-friend'].target['@id'] }));
          done();
        });
      });
    });

    describe('#make-friend', () => {
      it('calls xmpp.js correctly', (done) => {
        xp['remove-friend'](job['remove-friend'], () => {
          sinon.assert.calledOnce(xp.__client.send);
          sinon.assert.calledWith(xp.__client.send,
            xmlFake("presence", { type: "subscribe", to: job['make-friend'].target['@id'] }));
          done();
        });
      });
    });

    describe('#observe', () => {
      it('calls xmpp.js correctly', (done) => {
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
});
