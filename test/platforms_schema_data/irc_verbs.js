module.exports = {
  credentials: {
    'testuser' : {
      'server': 'irc.host.net',
      'nick': 'testuser',
      'password': 'asdasdasdasd'
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
  ]
};