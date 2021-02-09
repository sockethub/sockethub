const stanzas = {
  subscribe: `<presence from=’user1@example.com’ to=’user2@example.com’ type=’subscribe’/>`,
  subscribed: `<presence from=’user2@example.com’ to=’user1@example.com’ type=’subscribed’/>`,
  status: `<presence> <show>away</show> <status>feeding the chickens</status </presence>`,
  message: `<message from=’abc@example.com’ to=’xyz@example.com’ type=’chat’> <body>hello worldP</body> </message>`,
  // room examples grabbed from https://xmpp.org/extensions/xep-0045.html#enter
  getRoster: `<iq from=’abc@example.com’ type=’get’ id=’xyz123’> <query xmlns=’jabber:iq:roster’/> </iq>`,
  sendRoster: `<iq to=’abc@example.com’ type=’result’ id=’xyz123’> <query xmlns=’jabber:iq:roster’> <item jid=’efg@example.com’ name=’EFG’/> <item jid=’hij’@ example.com’ name=’HIJ’/> </query> </iq>`,
  joinRoom: `<presence from='hag66@shakespeare.lit/pda' id='n13mt3l' to='coven@chat.shakespeare.lit/thirdwitch'> <x xmlns='http://jabber.org/protocol/muc'/> </presence>`,
  jidMalformed: `<presence from='coven@chat.shakespeare.lit' id='273hs51g' to='hag66@shakespeare.lit/pda' type='error'> <error by='coven@chat.shakespeare.lit' type='modify'> <jid-malformed xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/> </error> </presence>`,
  roomPresence: [
    `<presence from='coven@chat.shakespeare.lit/firstwitch' id='3DCB0401-D7CF-4E31-BE05-EDF8D057BFBD' to='hag66@shakespeare.lit/pda'> <x xmlns='http://jabber.org/protocol/muc#user'> <item affiliation='owner' role='moderator'/> </x> </presence>`,
    `<presence from='coven@chat.shakespeare.lit/thirdwitch' id='27C55F89-1C6A-459A-9EB5-77690145D624' to='crone1@shakespeare.lit/desktop'> <x xmlns='http://jabber.org/protocol/muc#user'> <item affiliation='member' role='participant'/> </x> </presence>`,
    `<presence from='coven@chat.shakespeare.lit/thirdwitch' id='17232D15-134F-43C8-9A29-61C20A64B236' to='crone1@shakespeare.lit/desktop'> <x xmlns='http://jabber.org/protocol/muc#user'> <item affiliation='none' jid='hag66@shakespeare.lit/pda' role='participant'/> </x> </presence>`,
  ],
};


// XMPP as incoming JS objects, examples:
// GROUPMESSAGE
//
// incoming stanza  <ref *1> Element {
//   name: 'message',
//   parent: Element {
//     name: 'stream:stream',
//     parent: null,
//     children: [],
//     attrs: {
//       id: '11206930717011432258',
//       version: '1.0',
//       'xml:lang': 'en',
//       'xmlns:stream': 'http://etherx.jabber.org/streams',
//       from: 'kosmos.org',
//       xmlns: 'jabber:client'
//     }
//   },
//   attrs: {
//     'xml:lang': 'en',
//     to: 'jimmy@kosmos.org/hyperchannel',
//     from: 'kosmos-random@kosmos.chat/raucao',
//     type: 'groupchat',
//     id: '2a755e35-9939-447a-a076-2ea803ca69e9'
//   }
// }
//
//
// LEAVE ROOM
//
// incoming stanza  <ref *1> Element {
//   name: 'presence',
//   parent: Element {
//     name: 'stream:stream',
//     parent: null,
//     children: [],
//     attrs: {
//       id: '1691885476301117321',
//       version: '1.0',
//       'xml:lang': 'en',
//       'xmlns:stream': 'http://etherx.jabber.org/streams',
//       from: 'kosmos.org',
//       xmlns: 'jabber:client'
//     }
//   },
//   attrs: {
//     'xml:lang': 'en',
//     to: 'jimmy@kosmos.org/hyperchannel',
//     from: 'kosmos-random@kosmos.chat/raucao',
//     type: 'unavailable',
//     id: 'f8704b55-b012-43ea-b033-21bf47984752'
//   }
// }
//
//
// JOIN ROOM
//
// incoming stanza  <ref *1> Element {
//   name: 'presence',
//   parent: Element {
//     name: 'stream:stream',
//     parent: null,
//     children: [],
//     attrs: {
//       id: '1691885476301117321',
//       version: '1.0',
//       'xml:lang': 'en',
//       'xmlns:stream': 'http://etherx.jabber.org/streams',
//       from: 'kosmos.org',
//       xmlns: 'jabber:client'
//     }
//   },
//   attrs: {
//     'xml:lang': 'en',
//     to: 'jimmy@kosmos.org/hyperchannel',
//     from: 'kosmos-random@kosmos.chat/raucao',
//     id: 'edaff0d8-869d-47cd-901c-74475749473c'
//   }
// }