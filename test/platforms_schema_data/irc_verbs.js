module.exports = {
  credentials: {
    'testuser' : {
      'actor': {
        'address': 'testuser'
      },
      'object': {
        'objectType': 'credentials',
        'server': 'irc.host.net',
        'nick': 'testuser',
        'password': 'asdasdasdasd'
      }
    }
  },
  join: [
    {
      platform: 'irc',
      verb: 'join',
      actor: {
        address: 'testuser'
      },
      target: [
        {
          address: '#sockethub'
        },
        {
          address: '#remotestorage'
        }
      ],
      object: {},
      rid: 1234
    }
  ],
  send: [
    {
      platform: 'irc',
      verb: 'send',
      actor: {
        address: 'testuser'
      },
      target: [
        {
          address: '#sockethub'
        }
      ],
      object: {
        text: 'Hello from Sockethub!'
      },
      rid: 1234
    },
    {
      platform: 'irc',
      verb: 'send',
      actor: {
        address: 'newuser'
      },
      target: [
        {
          address: '#sockethub'
        }
      ],
      object: {
        text: 'Hello from Sockethub!'
      },
      rid: 1234
    }
  ],
  leave: [
    {
      platform: 'irc',
      verb: 'leave',
      actor: {
        address: 'testuser'
      },
      target: [
        {
          address: '#remotestorage'
        }
      ],
      object: {},
      rid: 1234
    }
  ],
  observe: [
    {
      platform: 'irc',
      verb: 'observe',
      actor: {
        address: 'testuser'
      },
      target: [
        {
          address: '#sockethub'
        }
      ],
      object: {
        objectType: 'attendance'
      },
      rid: 1234
    }
  ],
  update: [
    {
      platform: 'irc',
      verb: 'update',
      actor: {
        address: 'testuser'
      },
      target: [
        {
          address: '#sockethub'
        }
      ],
      object: {
        objectType: 'topic',
        topic: 'New version of Socekthub released!'
      },
      rid: 1234
    },
    {
      platform: 'irc',
      verb: 'update',
      actor: {
        address: 'testuser'
      },
      target: [
        {
          address: 'newuser'
        }
      ],
      object: {
        objectType: 'address'
      },
      rid: 1234
    }
  ]
};