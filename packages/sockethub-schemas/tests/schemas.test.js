const tv4 = require('tv4');
const {beforeAll} = require("@jest/globals");
const schemaSHAS = require('./../schemas/activity-stream');
const BASE_SCHEMA_ID = 'http://sockethub.org/schemas/v0/';

const testActivityStreams = [
  [ 'one',
    {
      '@type': 'send',
      context: 'irc',
      actor: {
        '@id': 'dood@irc.freenode.net',
        '@type': 'person',
        displayName: 'dood'
      },
      target: {
        '@id': 'irc.freenode.net/sockethub',
        '@type': 'room',
        displayName: 'sockethub'
      },
      object: {
        '@type': 'credentials'
      }
    },
    true,
    ''
  ], [
    'bad uri in target',
    {
      '@id': 'blah',
      '@type': 'send',
      context: 'dood',
      actor: {
        '@id': 'dood@irc.freenode.net',
        '@type': 'person',
        displayName: 'dood'
      },
      target: {
        '@type': 'person',
        displayName: 'bob'
      },
      object: {
        '@type': 'credentials'
      }
    },
    false,
    '/target:Data does not match any schemas from "oneOf"'
  ], [
    'wrong actor type',
    {
      '@id': 'blah',
      '@type': 'send',
      context: 'dood',
      actor: {
        id: 'doobar@freenode.net/channel',
        '@type': 'message',
        content: 'hi there'
      },
      target: {
        '@id': 'bob@crusty.net/Home',
        '@type': 'person',
        displayName: 'bob'
      },
      object: {
        '@type': 'feed',
        '@id': 'http://rss.example.org/feed.rss'
      }
    },
    false,
    '/actor:Data does not match any schemas from "oneOf"'
  ], [
    'missing actor id',
    {
      '@id': 'blah',
      '@type': 'send',
      context: 'dood',
      actor: {
        '@type': 'person',
        displayName: 'dood'
      },
      target: {
        '@id': 'bob@crusty.net/Home',
        '@type': 'person',
        displayName: 'bob'
      },
      object: {
        '@type': 'feed',
        '@id': 'http://rss.example.org/feed.rss'
      }
    },
    false,
    '/actor:Data does not match any schemas from "oneOf"'
  ]
];

expect.extend({
  toBeValidSchema(received, expected, msg) {
    if (received === expected) {
      return {
        message: () => `validation successful`,
        pass: true
      };
    } else {
      return {
        message: () => `validation failed: ${msg}`,
        pass: false
      };
    }
  }
});

describe('ActivityStream validation', () => {
  const schemaId = BASE_SCHEMA_ID + 'activity-stream#';
  beforeAll(() => {
    expect(typeof schemaSHAS).toBe('object')
    expect(schemaSHAS.id).toBe(schemaId);
    tv4.addSchema(schemaSHAS.id, schemaSHAS);
  });

  it.each(testActivityStreams)("input object '%s'", (name, AS, expectedResult, expectedFailureMessage) => {
    const result = tv4.validate(AS, schemaId);
    const msg = (tv4.error) ? `${tv4.error.dataPath}:${tv4.error.message}` : '';
    expect(result).toBeValidSchema(expectedResult, msg);
    expect(msg).toBe(expectedFailureMessage);
  })
});
