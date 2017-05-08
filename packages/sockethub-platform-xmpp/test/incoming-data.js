module.exports = {
  // 'presence-1': {
  //   input: '<presence from="hermes@5apps.com/hyperchannel" xmlns:stream="http://etherx.jabber.org/streams"/>',
  //   as: {}
  // },
  'presence-2': {
    input: '<presence type="error" to="hermes@5apps.com/hyperchannel" from="irc://xmpp.5apps.com/#watercooler" xmlns:stream="http://etherx.jabber.org/streams"><error type="cancel"><remote-server-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/></error></presence>',
    as: {
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
  'presence-3': {
    input: '<presence type="error" to="hermes@5apps.com/hyperchannel" from="irc://xmpp.5apps.com/#watercooler" xmlns:stream="http://etherx.jabber.org/streams"><error type="cancel"><not-allowed xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/><text xmlns="urn:ietf:params:xml:ns:xmpp-stanzas">Communication with remote domains is not enabled</text></error></presence>',
    as: {
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
  }
}