export const actor = {
  type: "person",
  id: "testingham@jabber.net",
  name: "testing ham",
};

export const credentials = {
  actor: actor,
  object: {
    type: "credentials",
    userAddress: "testingham@jabber.net",
    password: "foobar",
    resource: "home",
  },
};

export const target = {
  mrfoobar: {
    type: "person",
    id: "mrfoobar@jabber.net",
    name: "Mr FooBar",
  },
  partyroom: {
    type: "room",
    id: "partyroom@jabber.net",
  },
  roomuser: {
    type: "room",
    id: "partyroom@jabber.net/ms tut",
  },
};

export const job = {
  connect: {
    context: "xmpp",
    type: "connect",
    actor: {
      id: "slvrbckt@jabber.net/Home",
      type: "person",
      name: "Nick Jennings",
      userName: "slvrbckt",
    },
  },
  join: {
    actor: actor,
    object: {
      type: "update",
      name: "Frank",
    },
    target: target.partyroom,
  },
  leave: {
    actor: actor,
    target: target.partyroom,
  },
  send: {
    chat: {
      actor: actor,
      object: {
        type: "message",
        id: "hc-1234abcd",
        content: "hello",
      },
      target: target.mrfoobar,
    },
    groupchat: {
      actor: actor,
      object: {
        type: "message",
        id: "hc-1234abcd",
        content: "hi all",
      },
      target: target.roomuser,
    },
    correction: {
      actor: actor,
      object: {
        type: "message",
        id: "hc-1234abcd",
        content: "hi yall",
        "xmpp:replace": { id: "hc-234bcde" },
      },
      target: target.roomuser,
    },
  },
  update: {
    presenceOnline: {
      actor: actor,
      object: {
        type: "presence",
        presence: "online",
        content: "ready to chat",
      },
    },
    presenceUnavailable: {
      actor: actor,
      object: {
        type: "presence",
        presence: "away",
        content: "eating popcorn",
      },
    },
    presenceOffline: {
      actor: actor,
      object: {
        type: "presence",
        presence: "offline",
        content: "",
      },
    },
  },
  "request-friend": {
    actor: actor,
    target: target.mrfoobar,
  },
  "remove-friend": {
    actor: actor,
    target: target.mrfoobar,
  },
  "make-friend": {
    actor: actor,
    target: target.mrfoobar,
  },
  query: {
    actor: actor,
    target: target.partyroom,
    object: {
      type: "attendance",
    },
  },
};
