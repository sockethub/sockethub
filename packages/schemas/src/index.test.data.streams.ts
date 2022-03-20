import {ObjectTypesList} from './helpers/objects';

export default [
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
        id: 'irc.freenode.net/server',
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
        id: 'irc.freenode.net/server',
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
      id: 'blah',
      type: 'send',
      context: 'dood',
      actor: {
        id: 'dood@irc.freenode.net',
        type: 'person',
        name: 'dood'
      },
      target: {
        type: 'person',
        name: 'bob'
      },
      object: {
        type: 'credentials'
      }
    },
    false,
    '/target: must have required property \'id\''
  ],

  [
    'bad iri in object id',
    {
      type: 'feed',
      context: 'dood',
      actor: {
        id: 'dood@irc.freenode.net',
        type: 'person'
      },
      object: {
        id: 'example.org/some/path.html',
        type: 'website'
      }
    },
    false,
    '/object/id: must match format "iri"'
  ],

  [
    'valid iri in object id',
    {
      type: 'feed',
      context: 'dood',
      actor: {
        id: 'dood@irc.freenode.net',
        type: 'person'
      },
      object: {
        id: 'https://example.org/some/path.html',
        type: 'website'
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
    `/actor: must match exactly one schema in oneOf: ${ObjectTypesList.join(', ')}`
  ],

  [
    'missing actor id',
    {
      id: 'blah',
      type: 'send',
      context: 'dood',
      actor: {
        type: 'person',
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
  ],

  [
    'attendance request',
    {
      id: 'blah',
      type: 'observe',
      context: 'dood',
      actor: {
        id: 'dood',
        type: 'person'
      },
      target: {
        id: 'chatroom@crusty.net',
        type: 'room'
      },
      object: {
        type: 'attendance',
      }
    },
    true,
    ''
  ],

  [
    'attendance response',
    {
      id: 'blah',
      type: 'observe',
      context: 'dood',
      actor: {
        id: 'chatroom@crusty.net',
        type: 'room',
        name: 'chatroom'
      },
      object: {
        type: 'attendance',
        members: ['bill', 'bob', 'hank']
      }
    },
    true,
    ''
  ],

  [
    'invalid attendance request',
    {
      id: 'blah',
      type: 'observe',
      context: 'dood',
      actor: {
        id: 'dood',
        type: 'person'
      },
      target: {
        id: 'chatroom@crusty.net',
        type: 'room'
      },
      object: {
        type: 'attendance',
        status: 'foobar'
      }
    },
    false,
    '/object: must NOT have additional properties: status'
  ],

  [
    'setting presence',
    {
      id: 'blah',
      type: 'observe',
      context: 'dood',
      actor: {
        id: 'dood',
        type: 'person'
      },
      object: {
        type: 'presence',
        presence: 'away',
        content: 'forgot the milk'
      },
      target: {
        id: 'chatroom@crusty.net',
        type: 'room'
      }
    },
    true,
    ''
  ],

  [
    'setting invalid presence',
    {
      id: 'blah',
      type: 'observe',
      context: 'dood',
      actor: {
        id: 'dood',
        type: 'person'
      },
      object: {
        type: 'presence',
        presence: 'afk',
        content: 'forgot the milk'
      },
      target: {
        id: 'chatroom@crusty.net',
        type: 'room'
      }
    },
    false,
    '/object/presence: must be equal to one of the allowed values: ' +
    'away, chat, dnd, xa, offline, online'
  ],

  [
    'setting topic',
    {
      id: 'blah',
      type: 'observe',
      context: 'dood',
      actor: {
        id: 'dood',
        type: 'person'
      },
      object: {
        type: 'topic',
        content: 'the topic is goats'
      },
      target: {
        id: 'chatroom@crusty.net',
        type: 'room'
      }
    },
    true,
    ''
  ],

  [
    'setting topic incorrectly',
    {
      id: 'blah',
      type: 'observe',
      context: 'dood',
      actor: {
        id: 'dood',
        type: 'person'
      },
      object: {
        type: 'topic',
        topic: 'the topic is goats'
      },
      target: {
        id: 'chatroom@crusty.net',
        type: 'room'
      }
    },
    false,
    '/object: must NOT have additional properties: topic'
  ],


  [
    'receive topic',
    {
      id: 'blah',
      type: 'observe',
      context: 'dood',
      actor: {
        id: 'chatroom@crusty.net',
        type: 'room'
      },
      object: {
        type: 'topic',
        content: 'the topic is goats'
      }
    },
    true,
    ''
  ],

  [
    'change user address',
    {
      id: 'blah',
      type: 'update',
      context: 'dood',
      actor: {
        id: 'foobar@example.com',
        type: 'person'
      },
      object: {
        type: 'address'
      },
      target: {
        id: 'futurebar@example.com',
        type: 'person'
      },
    },
    true,
    ''
  ],

  [
    'change user address incorrectly',
    {
      type: 'update',
      context: 'dood',
      actor: {
        id: 'foobar@example.com',
        type: 'person'
      },
      object: {
        type: 'address',
        id: 'futurebar@example.com',
      }
    },
    false,
    '/object: must NOT have additional properties: id'
  ],

  [
    'invalid activity stream',
    {
      "actor": { "id": "irc://uuu@localhost", "type": "person" },
      "context":"irc",
      "target": { "id": "irc://irc.dooder.net/a-room", "type": "room" }
    },
    false,
    'activity stream: must have required property \'type\''
  ],

  [
    'invalid room',
    {
      "context":"irc",
      "type":"credentials",
      "actor":{
        "id":"sh-9K3Vk@irc.freenode.net",
        "type":"person",
      },
      "target": {
        "type":"room",
        "name":"sh-9K3Vk"
      }
    },
    false,
    '/target: must have required property \'id\''
  ],

  [
    'relationship',
    {
      "context":"irc",
      "type":"add",
      "actor":{"type":"person", "id":"alice@localhost", "name":"alice"},
      "target":{"type":"person", "id":"Kilroy@localhost", "name":"Kilroy"},
      "object":{
        "type":"relationship",
        "relationship":"role",
        "subject": {
          "type":"presence",
          "role":"owner"
        },
        "object":{
          "type":"room",
          "id":"localhost/#Finnish",
          "name":"#Finnish"
        }
      }
    },
    true, ""
  ],

  [
    'invalid role in relationship',
    {
      "context":"irc",
      "type":"add",
      "actor":{"type":"person", "id":"alice@localhost", "name":"alice"},
      "target":{"type":"person", "id":"Kilroy@localhost", "name":"Kilroy"},
      "object":{
        "type":"relationship",
        "relationship":"role",
        "subject": {
          "type":"presence",
          "role":"manager"
        },
        "object":{
          "type":"room",
          "id":"localhost/#Finnish",
          "name":"#Finnish"
        }
      }
    },
    false, "/object/subject/role: must be equal to one of the allowed values: " +
    "owner, member, participant, admin"
  ]
];
