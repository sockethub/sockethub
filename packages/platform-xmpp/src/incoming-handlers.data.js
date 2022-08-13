module.exports = [
  [
    `presence error 1`,
    `<presence type="error" to="hermes@5apps.com/hyperchannel" from="xmpp.5apps.com/#watercooler" xmlns:stream="http://etherx.jabber.org/streams"><error type="cancel"> <remote-server-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/></error></presence>`,
    {context: 'xmpp', type: 'join', actor: {id: 'xmpp.5apps.com/#watercooler', 'type': 'room'},
      error: 'remote server not found xmpp.5apps.com/#watercooler',
      target: {id: 'hermes@5apps.com/hyperchannel', type: 'person'}}
  ],
  [
    `presence error 2`,
    `<presence type="error" to="hermes@5apps.com/hyperchannel" from="xmpp.5apps.com/#watercooler" xmlns:stream="http://etherx.jabber.org/streams"><error type="cancel"><not-allowed xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/><text xmlns="urn:ietf:params:xml:ns:xmpp-stanzas">Communication with remote domains is not enabled</text></error></presence>`,
    {context: 'xmpp', type: 'update', actor: {id: 'xmpp.5apps.com/#watercooler', 'type': 'room'},
      error: '<error type="cancel"><not-allowed xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>' +
        '<text xmlns="urn:ietf:params:xml:ns:xmpp-stanzas">Communication with remote domains is not enabled</text>' +
        '</error>',
      target: {id: 'hermes@5apps.com/hyperchannel', type: 'person'}}
  ],
  [
    `initial presence`,
    `<presence to="foo@bar.org" from="baz@bag.org"></presence>`,
    {context: 'xmpp', type: 'update', actor: { id: "baz@bag.org", type: "person" },
      target: { id: "foo@bar.org", type: 'person' }, object: {type: 'presence', presence: "online"}}
  ],
  [
    `presence body`,
    `<presence to="foo@bar.org" from="baz@bag.org"><show>online</show> <status>away message!</status></presence>`,
    {context: 'xmpp', type: 'update', actor: { id: "baz@bag.org", type: "person" },
      target: { id: "foo@bar.org", type: 'person' }, object: {type: 'presence', content: "away message!",
        presence: "online"}}
  ],
  [
    `presence unavailable`,
    `<presence to="foo@bar.org/hyperchannel" from="baz@bag.org/yarg" type="unavailable"><x xmlns="http://jabber.org/protocol/muc#user"><item affiliation="owner" role="none"></item></x></presence>`,
    { context: 'xmpp', type: "update", actor: { type: "person", id: "baz@bag.org/yarg" },
      target: { id: "foo@bar.org/hyperchannel", type: 'person' },
      object: { type: "presence", presence: "offline" },
    }
  ],
  [
    `presence away`,
    `<presence to="foo@bar.org/hyperchannel" from="baz@bag.org/yarg" type="available"><show>away</show><x xmlns="http://jabber.org/protocol/muc#user"><item affiliation="owner" role="none"></item></x></presence>`,
    { context: 'xmpp', type: "update", actor: { type: "person", id: "baz@bag.org/yarg" },
      target: { id: "foo@bar.org/hyperchannel", type: 'person' },
      object: { type: "presence", presence: "away" },
    }
  ],
  [
    'attendance',
    `<iq id="muc_id" type="result" to="ernie@jabber.net/Home" from="PartyChatRoom@jabber.net" xmlns:stream="http://etherx.jabber.org/streams"> <query xmlns="http://jabber.org/protocol/disco#items"> <item jid="PartyChatRoom@jabber.net/ernie" name="ernie"/> <item jid="PartyChatRoom@jabber.net/bert" name="bert"/><item jid="PartyChatRoom@jabber.net/oscar" name="oscar"/> <item jid="PartyChatRoom@jabber.net/big_bird" name="big_bird"/> <item jid="PartyChatRoom@jabber.net/elmo" name="elmo"/></query></iq>`,
    {context: 'xmpp', type: 'query', actor: {id: 'PartyChatRoom@jabber.net', 'type': 'room'},
      target: {id: 'ernie@jabber.net/Home', type: 'person'}, object: {'type': 'attendance',
        members: ['ernie', 'bert', 'oscar', 'big_bird', 'elmo']}}
  ],
  [
    'message',
    `<message from="radical@example.org/thinkpad" to="user@jabber.org" type="chat" id="purple9840c15f" xmlns:stream="http://etherx.jabber.org/streams">
       <active xmlns="http://jabber.org/protocol/chatstates" />
       <stanza-id xmlns="urn:xmpp:sid:0" id="123456789" />
       <body>ohai</body>
     </message>`,
    {
      context: 'xmpp',
      type: 'send',
      actor: { type: 'person', id: 'radical@example.org/thinkpad' },
      target: { type: 'person', id: 'user@jabber.org' },
      object: { type: 'message', content: 'ohai',
        id: 'purple9840c15f', 'xmpp:stanza-id': '123456789' }
    }
  ],
  [
    'message with delay (e.g. offline message)',
    `<message from="radical@example.org/thinkpad" to="user@jabber.org" type="chat" id="purple9840c15f" xmlns:stream="http://etherx.jabber.org/streams">
       <active xmlns="http://jabber.org/protocol/chatstates" />
       <stanza-id xmlns="urn:xmpp:sid:0" id="123456789" />
       <delay xmlns="urn:xmpp:delay" from="jabber.org" stamp="2021-04-17T18:50:25Z">Offline Storage</delay>
       <body>ohai</body>
     </message>`,
    {
      context: 'xmpp',
      type: 'send',
      published: '2021-04-17T18:50:25.000Z',
      actor: { type: 'person', id: 'radical@example.org/thinkpad' },
      target: { type: 'person', id: 'user@jabber.org' },
      object: {
        type: 'message',
        content: 'ohai',
        id: 'purple9840c15f',
        'xmpp:stanza-id': '123456789'
      }
    }
  ],
  [
    'message correction (XEP-0308)',
    `<message from="radical@example.org/thinkpad" to="user@jabber.org" type="chat" id="purple9840c15f" xmlns:stream="http://etherx.jabber.org/streams">
       <active xmlns="http://jabber.org/protocol/chatstates" />
       <stanza-id xmlns="urn:xmpp:sid:0" id="123456789" />
       <replace id="purple1234c15f" />
       <body>oh hey</body>
     </message>`,
    {
      context: 'xmpp',
      type: 'send',
      actor: { type: 'person', id: 'radical@example.org/thinkpad' },
      target: { type: 'person', id: 'user@jabber.org' },
      object: { type: 'message', content: 'oh hey',
        id: 'purple9840c15f', 'xmpp:stanza-id': '123456789',
        'xmpp:replace': { id: 'purple1234c15f' } }
    }
  ],
  [
    'group presence',
    `<presence from='room@xmpp.example.org/speedboat'><show>chat</show> <status>brrroom!</status></presence>`,
    {context: 'xmpp', type: 'update', actor: {id: 'room@xmpp.example.org/speedboat', 'type': 'person',
      name: 'speedboat'}, object: {type: 'presence', content: 'brrroom!',
      presence: 'chat' }}
  ],
  [
    'group message',
    `<message from='coven@chat.shakespeare.lit/thirdwitch' id='hysf1v37' to='crone1@shakespeare.lit/desktop' type='groupchat'>
       <stanza-id id="123456789" />
       <body>Thrice the brinded cat hath mew'd.</body>
     </message>`,
    {
      context: 'xmpp',
      type: 'send',
      actor: { type: 'person', id: 'coven@chat.shakespeare.lit/thirdwitch', name: 'thirdwitch' },
      target: { type: 'room', id: 'coven@chat.shakespeare.lit' },
      object: { id: 'hysf1v37', type: 'message', content: 'Thrice the brinded cat hath mew\'d.',
        'xmpp:stanza-id': '123456789'}
    }
  ],
  // [
  //   'subscribe',
  //   `<presence from=’user1@example.com’ to=’user2@example.com’ type=’subscribe’></presence>`,
  //   {}
  // ],
  // [
  //   'subscribed',
  //   `<presence from=’user2@example.com’ to=’user1@example.com’ type=’subscribed’></presence>`,
  //   {}
  // ],
  // [
  //   'status',
  //   `<presence><show>away</show><status>feeding the chickens</status></presence>`,
  //   {}
  // ],
  // [
  //   'request roster',
  //   `<iq from=’abc@example.com’ type=’get’ id=’xyz123’>
  //   <query xmlns=’jabber:iq:roster’/> </iq>`,
  //   {}
  // ],
  // [
  //   'present roster',
  //   `<iq to=’abc@example.com’ type=’result’ id=’xyz123’> <query xmlns=’jabber:iq:roster’>
  //    <item jid=’efg@example.com’ name=’EFG’/> <item jid=’hij’@ example.com’ name=’HIJ’/>
  //    </query> </iq>`,
  //   {}
  // ],
  // [
  //   'join room',
  //   `<presence from='hav66@shakespeare.lit/pda' id='n13mt3l'
  //   to='coven@chat.shakespeare.lit/thirdwitch'>
  //   <x xmlns='http://jabber.org/protocol/muc'/> </presence>`,
  //   {}
  // ],
  [
    'JID malformed',
    `<presence from='coven@chat.shakespeare.lit' id='273hs51g' to='hag66@shakespeare.lit/pda' type='error'> <error by='coven@chat.shakespeare.lit' type='modify'> <jid-malformed xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/> </error> </presence>`,
    {context: 'xmpp', type: "update", actor: {id: "coven@chat.shakespeare.lit", type: "room"},
      error: `<error by="coven@chat.shakespeare.lit" type="modify"> <jid-malformed xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/> </error>`,
      target: {id: "hag66@shakespeare.lit/pda", type: "person"} },
  ]
  // [
  //   'presence affiliation owner',
  //   `<presence from='coven@chat.shakespeare.lit/firstwitch'
  //   id='3DCB0401-D7CF-4E31-BE05-EDF8D057BFBD' to='hag66@shakespeare.lit/pda'>
  //   <x xmlns='http://jabber.org/protocol/muc#user'> <item affiliation='owner'
  //   role='moderator'/> </x> </presence>`,
  //   {}
  // ],
  // [
  //   'presence affiliation member',
  //   `<presence from='coven@chat.shakespeare.lit/thirdwitch'
  //   id='27C55F89-1C6A-459A-9EB5-77690145D624' to='crone1@shakespeare.lit/desktop'>
  //   <x xmlns='http://jabber.org/protocol/muc#user'> <item affiliation='member'
  //   role='participant'/> </x> </presence>`,
  //   {}
  // ],
  // [
  //   'presence affiliation none',
  //   `<presence from='coven@chat.shakespeare.lit/thirdwitch'
  //   id='17232D15-134F-43C8-9A29-61C20A64B236' to='crone1@shakespeare.lit/desktop'>
  //   <x xmlns='http://jabber.org/protocol/muc#user'> <item affiliation='none'
  //   jid='hag66@shakespeare.lit/pda' role='participant'/> </x> </presence>`,
  //   {}
  // ]
];
