module.exports = [
  [
    'type:send, object:message',
    {
      type: 'send',
      context: 'irc',
      actor: {
        id: 'dood@irc.freenode.net',
        type: 'person',
        name: 'dood'
      },
      target: {
        id: 'irc.freenode.net/sockethub',
        type: 'room',
        name: 'sockethub'
      },
      object: {
        type: 'message',
        content: 'some kind of message'
      }
    },
    true,
    ''
  ],

  [
    'type:credentials, object:credentials',
    {
      type: 'credentials',
      context: 'irc',
      actor: {
        id: 'dood@irc.freenode.net',
        type: 'person',
        name: 'dood'
      },
      target: {
        id: 'irc.freenode.net/sockethub',
        type: 'room',
        name: 'sockethub'
      },
      object: {
        type: 'credentials'
      }
    },
    true,
    ''
  ],

  [
    'type:credentials',
    {
      context: 'irc',
      type: 'credentials',
      actor: {
        id: 'dood@irc.freenode.net',
        type: 'person',
        name: 'dood'
      },
      object: {
        type: 'credentials',
        user: "foo",
        pass: "bar"
      }
    },
    true,
    ''
  ],

  [
    'bad target',
    {
    'id': 'blah',
      'type': 'send',
      context: 'dood',
      actor: {
        id: 'dood@irc.freenode.net',
        'type': 'person',
        name: 'dood'
      },
      target: {
        'type': 'person',
        name: 'bob'
      },
      object: {
        'type': 'credentials'
      }
    },
    false,
    '/target: must have required property \'id\''
  ],

  [
    'bad iri in object id',
    {
      'type': 'feed',
      context: 'dood',
      actor: {
        'id': 'dood@irc.freenode.net',
        'type': 'person'
      },
      object: {
        'id': 'example.org/some/path.html',
        'type': 'website'
      }
    },
    false,
    '/object/type: must be equal to one of the allowed values'
  ],

  [
    'valid iri in object id',
    {
      'type': 'feed',
      context: 'dood',
      actor: {
        'id': 'dood@irc.freenode.net',
        'type': 'person'
      },
      object: {
        'id': 'https://example.org/some/path.html',
        'type': 'website'
      }
    },
    true,
    ''
  ],

  [
    'wrong actor type',
    {
      type: 'send',
      context: 'dood',
      actor: {
        id: 'doobar@freenode.net/channel',
        type: 'foo',
        content: 'hi there'
      },
      object: {
        type: 'feed',
        id: 'http://rss.example.org/feed.rss'
      }
    },
    false,
    '/actor/type: must be equal to one of the allowed values'
  ],

  [
    'missing actor id',
    {
      'id': 'blah',
      'type': 'send',
      context: 'dood',
      actor: {
        'type': 'person',
        name: 'dood'
      },
      target: {
        id: 'bob@crusty.net/Home',
        type: 'person',
        name: 'bob'
      },
      object: {
        type: 'feed',
        id: 'http://rss.example.org/feed.rss'
      }
    },
    false,
    '/actor: must have required property \'id\''
  ]
];