if (typeof define !== 'function') {
  let define = require('amdefine')(module);
}
define(['require'], function (require) {
  return [
    {
      desc: 'client library tests',
      abortOnFail: true,
      setup: function (env, test) {
        env.ActivityStreams = require('./../node_modules/activity-streams/browser/activity-streams.js');
        env.SocketIO = require('./mock-socketio');
        env.socket = new env.SocketIO(test);
        global.ActivityStreams = env.ActivityStreams;
        env.SockethubClient = require('./../lib/client');
        env.client = new env.SockethubClient(env.socket);
        test.assertTypeAnd(ActivityStreams, 'function');
        test.assertTypeAnd(env.socket.on, 'function');
        test.assertType(env.client, 'object');
      },
      tests: [
        {
          desc: '#offline - send join',
          run: function (env, test) {
            env.socket.on('failure', () => {
              test.assert(this.run, test.run);
            });
            env.socket.on('completed', () => {
              test.fail();
            });
            env.socket.emit('message', {
              '@type': 'join',
              'actor': {
                '@id': 'irc://foobar@server.org'
              },
              'target': {
                '@id': 'irc://server.org/coolRoom'
              }
            });
          }
        },

        {
          desc: '#offline - send message',
          run: function (env, test) {
            env.socket.on('failure', () => {
              test.assert(this.run, test.run);
            });
            env.socket.on('completed', () => {
              test.fail();
            });
            env.socket.emit('message', {
              '@type': 'send',
              'actor': {
                '@id': 'irc://foobar@server.org'
              },
              'object': {
                'content': `that'\''s interesting, go on.`
              },
              'target': {
                '@id': 'irc://server.org/coolRoom'
              }
            });
          }
        },

        {
          desc: '#connect - go online and send join (should succeed)',
          run: function (env, test) {
            env.socket.on('failure', () => {
              test.fail();
            });
            env.socket.on('message', (content) => {
              test.assertAnd(content['@type'], 'join');
              test.assertAnd(content.target['@id'], 'irc://server.org/coolRoom');
              test.assert(this.run, test.run);
            });
            env.socket.emit('connect');
            env.socket.emit('message', {
              '@type': 'join',
              'actor': {
                '@id': 'irc://foobar@server.org'
              },
              'target': {
                '@id': 'irc://server.org/coolRoom'
              }
            });
          }
        },

        {
          desc: '#connect - send credentials',
          run: function (env, test) {
            env.socket.on('failure', () => {
              test.fail();
            });
            env.socket.on('credentials', (content) => {
              test.assertAnd(content.object['@type'], 'credentials');
              test.assertAnd(content.object.server, 'dallas-the-tv-show.tv');
              test.assert(this.run, test.run);
            });
            env.socket.emit('credentials', {
              'actor': {
                '@id': 'irc://foobar@server.org'
              },
              'object': {
                '@type': 'credentials',
                'server': 'dallas-the-tv-show.tv'
              }
            });
          }
        },
        {
          desc: '#connect - send activity object',
          run: function (env, test) {
            env.socket.on('failure', () => {
              test.fail();
            });
            env.socket.on('activity-object', (content) => {
              test.assertAnd(content['@type'], 'person');
              test.assertAnd(content.displayName, 'Freddie Kruger');
              test.assert(this.run, test.run);
            });
            env.socket.emit('activity-object', {
              '@type': 'person',
              '@id': 'irc://fkruger@server.org',
              'displayName': 'Freddie Kruger'
            });
          }
        },

        {
          desc: '#disconnect - go offline and send join (should fail)',
          run: function (env, test) {
            env.socket.on('failure', (content) => {
              test.assertAnd(content['@type'], 'join');
              test.assertAnd(content.target['@id'], 'irc://server.org/coolRoom2');
              test.assert(this.run, test.run);
            });
            env.socket.on('message', () => {
              test.fail();
            });
            env.socket.emit('disconnect');
            env.socket.emit('message', {
              '@type': 'join',
              'actor': {
                '@id': 'irc://foobar@server.org'
              },
              'target': {
                '@id': 'irc://server.org/coolRoom2'
              }
            });
          }
        },

        {
          desc: '#reconnect - go online and check if join was replayed',
          run: function (env, test) {
            // we expect a join, activity-object and credentials object to be replayed before
            // the test can be considered complete
            let count = 0;
            env.socket.on('failure', () => {
              test.fail();
            });

            env.socket.on('message', (content) => {
              test.assertAnd(content['@type'], 'join');
              test.assertAnd(content.target['@id'], 'irc://server.org/coolRoom');
              count += 1;
              if (count === 3) {
                test.done();
              }
              test.write('count ' + count + ' message');
            });

            env.socket.on('credentials', (content) => {
              test.assertAnd(content.object['@type'], 'credentials');
              test.assertAnd(content.object.server, 'dallas-the-tv-show.tv');
              count += 1;
              if (count === 3) {
                test.done();
              }
              test.write('count ' + count + ' credentials');
            });

            env.socket.on('activity-object', (content) => {
              test.assertAnd(content['@type'], 'person');
              test.assertAnd(content.displayName, 'Freddie Kruger');
              count += 1;
              if (count === 3) {
                test.done();
              }
              test.write('count ' + count + ' activity-object');
            });

            env.socket.emit('reconnect');
          }
        }
      ]
    }
  ];
});
