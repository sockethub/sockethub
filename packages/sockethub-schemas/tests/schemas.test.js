const chai = require('chai');
const expect = chai.expect;
const tv4 = require('tv4');
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

describe('ActivityStream validation', () => {
  const schemaId = BASE_SCHEMA_ID + 'activity-stream#';

  beforeEach(() => {
    expect(typeof schemaSHAS).to.equal('object')
    expect(schemaSHAS.id).to.equal(schemaId);
    tv4.addSchema(schemaSHAS.id, schemaSHAS);
  });

  testActivityStreams.forEach(([name, AS, expectedResult, expectedFailureMessage]) => {
    it(`input object ` + name, () => {
      const result = tv4.validate(AS, schemaId);
      const msg = (tv4.error) ? `${tv4.error.dataPath}:${tv4.error.message}` : '';
      expect(result).to.eql(expectedResult);
      expect(msg).to.equal(expectedFailureMessage);
    })
  })
});
