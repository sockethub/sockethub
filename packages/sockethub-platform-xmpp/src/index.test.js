const shXmpp = require('./index');
const { client, xml } = require("@xmpp/client");

jest.mock('@xmpp/client', () => ({
  __esModule: true,
  client: jest.fn(() => ({
    on: jest.fn(),
    start: jest.fn(() => Promise.resolve()),
    send: jest.fn(() => Promise.resolve()),
    join: jest.fn(() => Promise.resolve()),
  })),
  xml: jest.fn()
}));
jest.mock('./utils');

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

describe('XMPP platform initialization', () => {
  it('initializes the client correctly', done => {
    let xp;

    xp = new shXmpp({
      id: actor,
      debug: jest.fn(),
      sendToClient: jest.fn()
    });

    xp.connect(job.join, credentials, () => {
      expect(client).toHaveBeenCalled();
      expect(xp.__client).toHaveProperty('on');
      expect(xp.__client).toHaveProperty('start');
      expect(xp.__client).toHaveProperty('send');
      expect(xp.__client.start).toHaveBeenCalled();
      expect(xp.__client.on).toHaveBeenCalledWith('close', expect.anything());
      expect(xp.__client.on).toHaveBeenCalledWith('error', expect.anything());
      expect(xp.__client.on).toHaveBeenCalledWith('online', expect.anything());
      expect(xp.__client.on).toHaveBeenCalledWith('stanza', expect.anything());
      done();
    });
  });
});

describe('xmpp.js calls', () => {
  let xp;

  beforeEach(done => {
    xp = new shXmpp({ id: actor, debug: jest.fn(), sendToClient: jest.fn() });
    xp.connect(job.join, credentials, () => done());
  });

  describe('#join', () => {
    it('is called correctly', done => {
      xp.join(job.join, () => {
        expect(xp.__client.send).toHaveBeenCalled();
        expect(xml).toHaveBeenCalledWith(
          "presence", {"from": "testingham@jabber.net", "to": "partyroom@jabber.net/testing ham"});
        done();
      });
    });
  });

  describe('#send', () => {
    it('is called correctly for a 1:1 chat', done => {
      const message = xml(
        "message",
        {type: job.send.chat.target['@type'] === 'room' ? 'groupchat' : 'chat',
          to: job.send.chat.target['@id']},
        xml("body", {}, job.send.chat.object.content),
      );
      xp.send(job.send.chat, () => {
        expect(xp.__client.send).toHaveBeenCalledWith(message);
        done();
      });
    });

    it('is called correctly for a groupchat', (done) => {
      const message = xml(
        "message",
        {type: job.send.groupchat.target['@type'] === 'room' ? 'groupchat' : 'chat',
          to: job.send.groupchat.target['@id']},
        xml("body", {}, job.send.chat.object.content),
      );
      xp.send(job.send.groupchat, () => {
        expect(xp.__client.send).toHaveBeenCalledWith(message);
        done();
      });
    });
  });

  describe('#update', () => {
    it('is called correctly', done => {
      xp.update(job.update.presence, () => {
        expect(xp.__client.send).toHaveBeenCalled();
        expect(xp.__client.send).toHaveBeenCalledWith(xml("presence", { type: "available" }));
        done();
      });
    });
  });

  describe('#request-friend', () => {
    it('is called correctly', done => {
      xp['request-friend'](job['request-friend'], () => {
        expect(xp.__client.send).toHaveBeenCalled();
        expect(xp.__client.send).toHaveBeenCalledWith(
          xml("presence", { type: "subscribe", to: job['request-friend'].target['@id'] }));
        done();
      });
    });
  });

  describe('#remove-friend', () => {
    it('is called correctly', done => {
      xp['remove-friend'](job['remove-friend'], () => {
        expect(xp.__client.send).toHaveBeenCalled();
        expect(xp.__client.send).toHaveBeenCalledWith(
          xml("presence", { type: "subscribe", to: job['remove-friend'].target['@id'] }));
        done();
      });
    });
  });

  describe('#make-friend', () => {
    it('is called correctly', done => {
      xp['remove-friend'](job['remove-friend'], () => {
        expect(xp.__client.send).toHaveBeenCalled();
        expect(xp.__client.send).toHaveBeenCalledWith(
          xml("presence", { type: "subscribe", to: job['make-friend'].target['@id'] }));
        done();
      });
    });
  });

  describe('#observe', () => {
    it('is called correctly for room attendance', done => {
      xp.observe(job.observe, () => {
        expect(xp.__client.send).toHaveBeenCalled();
        expect(xml).toHaveBeenCalledWith(
          "presence", {"from": "testingham@jabber.net", "to": "partyroom@jabber.net/testing ham"});
        done();
      });
    });
  });
});
