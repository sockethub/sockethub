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
    input: ['test@muc.5apps.com', 'greg the speedboat', 'online', 'hey, wazzup?'],
    handler: 'groupBuddy',
    output: {
      '@type': 'update',
      actor: {
        '@id': 'test@muc.5apps.com/greg the speedboat',
        '@type': 'person',
        displayName: 'greg the speedboat'
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
  },
  {
    name: 'attendance',
    input: '<iq id="muc_id" type="result" to="ernie@jabber.net/Home" from="PartyChatRoom@jabber.net" xmlns:stream="http://etherx.jabber.org/streams"><query xmlns="http://jabber.org/protocol/disco#items"><item jid="PartyChatRoom@jabber.net/ernie" name="ernie"/><item jid="PartyChatRoom@jabber.net/bert" name="bert"/><item jid="PartyChatRoom@jabber.net/oscar" name="oscar"/><item jid="PartyChatRoom@jabber.net/big_bird" name="big_bird"/><item jid="PartyChatRoom@jabber.net/elmo" name="elmo"/></query></iq>',
    output: {
      '@type': 'observe',
      actor: {
        '@id': 'PartyChatRoom@jabber.net',
        '@type': 'room'
      },
      target: {
        '@id': 'ernie@jabber.net/Home',
        '@type': 'person'
      },
      object: {
        '@type': 'attendance',
        members: [
          'ernie',
          'bert',
          'oscar',
          'big_bird',
          'elmo'
        ]
      }
    }
  },
  {
    name: 'message',
    //input: '<message from="radical@example.org/thinkpad" to="user@jabber.org" type="chat" id="purple9840c15f" xmlns:stream="http://etherx.jabber.org/streams"><active xmlns="http://jabber.org/protocol/chatstates"/><body>ohai</body></message>',
    input: [ 'radical@example.org', 'ohai' ],
    handler: 'chat',
    output: {
      '@type': 'send',
      actor: {
        '@type': 'person',
        '@id': 'radical@example.org'
      },
      target: 'user@jabber.org',
      object: {
        '@type': 'message',
        content: 'ohai',
        '@id': 1
      }
    }
  }


];
