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

describe('bad initialization', () => {
  it('existing __client object is returned', (done) => {
    const xp = new shXmpp({
      id: actor,
      debug: jest.fn(),
      sendToClient: jest.fn()
    });

    xp.__client = 'foo';

    xp.connect(job.join, credentials, () => {
      expect(xp.__client).toBe('foo');
      expect(client).not.toHaveBeenCalled();
      expect(xp.sendToClient).not.toHaveBeenCalled();
      done();
    });
  });

  it('failed connect will delete the __client property', (done) => {
    const xp = new shXmpp({
      id: actor,
      debug: jest.fn(),
      sendToClient: jest.fn()
    });

    client.start = jest.fn(() => Promise.reject('foo'));

    xp.connect(job.join, credentials, () => {
      expect(client).toHaveBeenCalled();
      expect(xp.__client).not.toBeDefined();
      expect(xp.sendToClient).toHaveBeenCalled();
      done();
    });
  });
})


describe('xmpp platform initialization', () => {
  let xp;
  beforeEach((done) => {
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
      expect(xp.sendToClient).not.toHaveBeenCalled();
      expect(xp.__client.on).toHaveBeenCalledWith('close', expect.anything());
      expect(xp.__client.on).toHaveBeenCalledWith('error', expect.anything());
      expect(xp.__client.on).toHaveBeenCalledWith('online', expect.anything());
      expect(xp.__client.on).toHaveBeenCalledWith('stanza', expect.anything());
      done();
    });
  });

  it('calls xmpp.js correctly when #join is called', (done) => {
    xp.join(job.join, () => {
      expect(xp.__client.send).toHaveBeenCalled();
      expect(xml).toHaveBeenCalledWith(
        "presence", {"from": "testingham@jabber.net", "to": "partyroom@jabber.net/testing ham"});
      done();
    });
  });

  it('calls xmpp.js correctly when #send is called', (done) => {
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

  it('calls xmpp.js correctly when #send is called for a groupchat', (done) => {
    const message = xml(
      "message",
      {type: job.send.chat.target['@type'] === 'room' ? 'groupchat' : 'chat',
        to: job.send.chat.target['@id']},
      xml("body", {}, job.send.chat.object.content),
    );
    xp.send(job.send.groupchat, () => {
      expect(xp.__client.send).toHaveBeenCalledWith(message);
      done();
    });
  });

  it('calls xmpp.js correctly when #update is called', (done) => {
    xp.update(job.update.presence, () => {
      expect(xp.__client.send).toHaveBeenCalled();
      expect(xp.__client.send).toHaveBeenCalledWith(xml("presence", { type: "available" }));
      done();
    });
  });

  it('calls xmpp.js correctly when #request-friend is called', (done) => {
    xp['request-friend'](job['request-friend'], () => {
      expect(xp.__client.send).toHaveBeenCalled();
      expect(xp.__client.send).toHaveBeenCalledWith(
        xml("presence", { type: "subscribe", to: job['request-friend'].target['@id'] }));
      done();
    });
  });

  it('calls xmpp.js correctly when #remove-friend is called', (done) => {
    xp['remove-friend'](job['remove-friend'], () => {
      expect(xp.__client.send).toHaveBeenCalled();
      expect(xp.__client.send).toHaveBeenCalledWith(
        xml("presence", { type: "subscribe", to: job['remove-friend'].target['@id'] }));
      done();
    });
  });

  it('calls xmpp.js correctly when #make-friend is called', (done) => {
    xp['remove-friend'](job['remove-friend'], () => {
      expect(xp.__client.send).toHaveBeenCalled();
      expect(xp.__client.send).toHaveBeenCalledWith(
        xml("presence", { type: "subscribe", to: job['make-friend'].target['@id'] }));
      done();
    });
  });

  it('calls xmpp.js correctly when #observe is called', (done) => {
    xp.observe(job.observe, () => {
      expect(xp.__client.send).toHaveBeenCalled();
      expect(xml).toHaveBeenCalledWith(
        "presence", {"from": "testingham@jabber.net", "to": "partyroom@jabber.net/testing ham"});
      done();
    });
  });
});
