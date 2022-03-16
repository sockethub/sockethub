const o = require('./../src/object-types');

module.exports = [
  [
    'room object',
    {
      id: 'irc.freenode.net/server',
      type: 'room',
      name: 'sockethub'
    },
    true,
    ``
  ],

  [
    'credentials with no props',
    {
      type: 'credentials'
    },
    false,
    `/object: must match exactly one schema in oneOf: ${Object.keys(o.objectTypes).join(', ')}`
  ],

  [
    'credentials with props',
    {
      type: 'credentials',
      user: "foo",
      pass: "bar"
    },
    false,
    `/object: must match exactly one schema in oneOf: ${Object.keys(o.objectTypes).join(', ')}`
  ],

  [
    'bad target',
    {
      type: 'person',
      name: 'bob'
    },
    false,
    '/object: must have required property \'id\''
  ],

  [
    'bad iri in object id',
    {
      id: 'example.org/some/path.html',
      type: 'website'
    },
    false,
    '/object/id: must match format "iri"'
  ],

  [
    'valid iri in object id',
    {
      id: 'https://example.org/some/path.html',
      type: 'website'
    },
    true,
    ''
  ],

  [
    'wrong actor type',
    {
      id: 'doobar@freenode.net/channel',
      type: 'foo',
      content: 'hi there'
    },
    false,
    `/object: must match exactly one schema in oneOf: ${Object.keys(o.objectTypes).join(', ')}`
  ],

  [
    'missing actor id',
    {
      type: 'person',
      name: 'dood'
    },
    false,
    '/object: must have required property \'id\''
  ],

  [
    'attendance request',
    {
      type: 'attendance',
    },
    true,
    ''
  ],

  [
    'attendance response',
    {
      type: 'attendance',
      members: ['bill', 'bob', 'hank']
    },
    true,
    ''
  ],

  [
    'invalid attendance request',
    {
      type: 'attendance',
      status: 'foobar'
    },
    false,
    '/object: must NOT have additional properties: status'
  ],

  [
    'setting presence',
    {
      type: 'presence',
      presence: 'away',
      content: 'forgot the milk'
    },
    true,
    ''
  ],

  [
    'setting invalid presence',
    {
      type: 'presence',
      presence: 'afk',
      content: 'forgot the milk'
    },
    false,
    '/object/presence: must be equal to one of the allowed values: away, chat, dnd, xa, offline, online'
  ],

  [
    'setting topic',
    {
      type: 'topic',
      content: 'the topic is goats'
    },
    true,
    ''
  ],

  [
    'setting topic incorrectly',
    {
      type: 'topic',
      topic: 'the topic is goats'
    },
    false,
    '/object: must NOT have additional properties: topic'
  ],


  [
    'send message',
    {
      type: 'message',
      content: 'the message is goats'
    },
    true,
    ''
  ],

  [
    'change user address',
    {
      type: 'address'
    },
    true,
    ''
  ],

  [
    'change user address incorrectly',
    {
      type: 'address',
      id: 'futurebar@example.com',
    },
    false,
    '/object: must NOT have additional properties: id'
  ],


  [
    'invalid room',
    {
      "type":"room",
      "name":"sh-9K3Vk"
    },
    false,
    '/object: must have required property \'id\''
  ],

  [
    'relationship',
    {
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
    },
    true, ""
  ],

  [
    'invalid role in relationship',
    {
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
    },
    false, `/object/subject/role: must be equal to one of the allowed values: owner, member, participant, admin`
  ]
];