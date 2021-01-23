const shXmpp = require('./index');
const { client, xml } = require("@xmpp/client");

jest.mock('@xmpp/client', () => ({
  __esModule: true,
  client: jest.fn(() => ({
    on: jest.fn(),
    start: jest.fn(() => Promise.resolve()),
    send: jest.fn(),
    join: jest.fn()
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
  observe: {
    actor: actor,
    target: target.partyroom,
    object: {
      '@type': 'attendance'
    }
  }
};


describe('xmpp platform initialization', () => {
  let xp;

  beforeEach((done) => {
    xp = new shXmpp({
      id: actor,
      debug: jest.fn(),
      sendToClient: jest.fn()
    });

    xp.connect(job.join, credentials, () => {
      expect(client).toHaveBeenCalled()
      expect(xp.__client).toHaveProperty('on');
      expect(xp.__client).toHaveProperty('start');
      expect(xp.__client).toHaveProperty('send');
      expect(xp.__client.start).toHaveBeenCalled();
      expect(xp.__client.on).toHaveBeenCalledWith('close', expect.anything())
      expect(xp.__client.on).toHaveBeenCalledWith('error', expect.anything())
      expect(xp.__client.on).toHaveBeenCalledWith('online', expect.anything())
      expect(xp.__client.on).toHaveBeenCalledWith('stanza', expect.anything())
      done();
    })
  });

  it('calls xmppjs correctly #join is called', (done) => {
    xp.join(job.join, {}, () => {
      expect(xp.__client.send).toHaveBeenCalled()
      expect(xml).toHaveBeenCalledWith("presence", {"from": "testingham@jabber.net", "to": "partyroom@jabber.net/testing ham"})
      done();
    })
  })

  it('calls xmppjs correctly when #send is called', (done) => {
    xp.send(job.send.chat, {}, () => {
      expect(xp.__client.send).toHaveBeenCalledWith(job.send.chat.target['@id'], job.send.chat.object.content, "chat")
      done();
    })
  })

  it('calls xmppjs correctly when #send is called for a groupchat', (done) => {
    xp.send(job.send.groupchat, {}, () => {
      expect(xp.__client.send).toHaveBeenCalledWith(job.send.groupchat.target['@id'], job.send.groupchat.object.content, "groupchat")
      done();
    })
  })

  it('calls xmppjs correctly when #observe is called', (done) => {
    xp.observe(job.observe, {}, () => {
      expect(xp.__client.send).toHaveBeenCalled();
      expect(xml).toHaveBeenCalledWith("presence", {"from": "testingham@jabber.net", "to": "partyroom@jabber.net/testing ham"})
      done();
    })
  })
})