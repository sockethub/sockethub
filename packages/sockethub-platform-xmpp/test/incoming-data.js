module.exports = [
  // 'presence-1': {
  //   input: '<presence from="hermes@5apps.com/hyperchannel" xmlns:stream="http://etherx.jabber.org/streams"/>',
  //   as: {}
  // },
  {
    name: 'presence-2',
    input: '<presence type="error" to="hermes@5apps.com/hyperchannel" from="irc://xmpp.5apps.com/#watercooler" xmlns:stream="http://etherx.jabber.org/streams"><error type="cancel"><remote-server-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/></error></presence>',
    output: {
      '@type': 'join',
      actor: {
        '@id': 'irc://xmpp.5apps.com/#watercooler',
        '@type': 'room'
      },
      object: {
        '@type': 'error',
        content: 'remote server not found irc://xmpp.5apps.com/#watercooler'
      },
      target: {
        '@id': 'hermes@5apps.com/hyperchannel',
        '@type': 'person'
      }
    }
  },
  {
    name: 'presence-3',
    input: '<presence type="error" to="hermes@5apps.com/hyperchannel" from="irc://xmpp.5apps.com/#watercooler" xmlns:stream="http://etherx.jabber.org/streams"><error type="cancel"><not-allowed xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/><text xmlns="urn:ietf:params:xml:ns:xmpp-stanzas">Communication with remote domains is not enabled</text></error></presence>',
    output: {
      '@type': 'update',
      actor: {
        '@id': 'irc://xmpp.5apps.com/#watercooler',
        '@type': 'room'
      },
      object: {
        '@type': 'error',
        content: '<error type="cancel"><not-allowed xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/><text xmlns="urn:ietf:params:xml:ns:xmpp-stanzas">Communication with remote domains is not enabled</text></error>'
      },
      target: {
        '@id': 'hermes@5apps.com/hyperchannel',
        '@type': 'person'
      }
    }
  },
  {
    name: 'groupbuddy event',
    input: ['test@muc.5apps.com', 'greg', 'online', 'hey, wazzup?'],
    handler: 'groupbuddy',
    output: {
      '@type': 'update',
      actor: {
        '@id': 'test@muc.5apps.com/greg',
        '@type': 'person',
        displayName: 'greg'
      },
      target: {
        '@id': 'test@muc.5apps.com',
        '@type': 'room'
      },
      object: {
        '@type': 'presence',
        status: 'hey, wazzup?',
        presence: 'online'
      }
    }
  }
];
