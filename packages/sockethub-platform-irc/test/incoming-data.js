module.exports = [
  {
    name: 'no-channel',
    input: {
      prefix: 'verne.freenode.net',
      command: 'ERR_NOSUCHCHANNEL',
      params: [ 'foobar', 'hyperuser', 'No such channel' ],
      server: 'verne.freenode.net',
      raw: ':verne.freenode.net 403 foobar hyperuser :No such channel',
      time: '2017-05-09T22:05:53.764Z'
    },
    output: {
      '@type': 'join',
      actor: {
        '@id': 'irc://irc.freenode.net',
        '@type': 'service'
      },
      object: {
        '@type': 'error',
        content: 'no such channel #hyperuser'
      },
      target: {
        '@id': 'irc://foobar@irc.freenode.net',
        '@type': 'person'
      }
    }
  },
  {
    name: 'quit',
    input: {
      nickname: 'sandwich',
      username: '~sandwich',
      hostname: '87.78.135.102',
      message: 'Quit: sandwich',
      time: '2017-05-09T22:47:21.137Z',
      raw: ':derbumi_!~derbumi@87.78.135.102 QUIT :Quit: sandwich'
    },
    output: {
      '@type': 'leave',
      actor: {
        '@type': 'person',
        '@id': 'irc://sandwich@irc.freenode.net',
        displayName: 'sandwich'
      },
      target: {
        '@id': 'irc://irc.freenode.net',
        '@type': 'service'
      },
      object: {
        '@type': 'message',
        content: 'user has quit'
      },
      published: '2017-05-09T22:47:21.137Z'
    }
  },
  {
    name: 'leave',
    input: {
      nickname: 'sandwich',
      username: '~sandwich',
      hostname: '87.78.135.102',
      channel: '#sockethub',
      message: '',
      time: '2017-05-09T22:47:21.137Z',
      raw: ':sandwich!~sandwich@87.78.135.102 PART #sockethub'
    },
    output: {
      '@type': 'leave',
      actor: {
        '@type': 'person',
        '@id': 'irc://sandwich@irc.freenode.net',
        displayName: 'sandwich'
      },
      target: {
        '@id': 'irc://irc.freenode.net/#sockethub',
        '@type': 'room',
        displayName: '#sockethub'
      },
      object: {
        '@type': 'message',
        content: 'user has left the channel'
      },
      published: '2017-05-09T22:47:21.137Z'
    }
  },
  {
    name: 'join',
    input: { nickname: 'donut',
      username: '~donut',
      hostname: 'ip2f1ae3ea.dynamic.kabel-deutschland.de',
      channel: '#sockethub',
      time: '2017-05-09T22:52:25.006Z',
      raw: ':donut!~galfert1@ip2f1ae3ea.dynamic.kabel-deutschland.de JOIN #sockethub'
    },
    output: {
      '@type': 'join',
      actor: {
        '@type': 'person',
        '@id': 'irc://donut@irc.freenode.net',
        displayName: 'donut'
      },
      target: {
        '@id': 'irc://irc.freenode.net/#sockethub',
        '@type': 'room',
        displayName: '#sockethub'
      },
      object: {},
      published: '2017-05-09T22:52:25.006Z'
    }
  }
];
