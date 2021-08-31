function getMessageBody(stanza) {
  for (let elem of stanza.children) {
    if (elem.name === 'body') {
      return elem.children.join(' ');
    }
  }
}

function getMessageTimestamp(stanza) {
  try {
    const delay = stanza.children.find(c => c.name === 'delay');
    return delay.attrs.stamp;
  } catch (e) {
    // no timestamp
    return null;
  }
}

function getMessageId(stanza) {
  try {
    const stanzaId = stanza.children.find(c => c.name === 'stanza-id');
    return stanzaId.attrs.id;
  } catch (e) {
    // no stanza id
    return null;
  }
}

class IncomingHandlers {
  constructor(session) {
    this.session = session;
  }

  close() {
    this.session.debug('received close event with no handler specified');
    this.session.sendToClient({
      '@type': 'close',
      actor: this.session.actor,
      target: this.session.actor
    });
    this.session.debug('**** xmpp this.session.for ' + this.session.actor['@id'] + ' closed');
    this.session.connection.disconnect();
  }

  error(err) {
    try {
      this.session.sendToClient({
        '@type': 'error',
        object: {
          '@type': 'error',
          content: err.text || err.toString(),
          condition: err.condition || 'unknown'
        }
      });
    } catch (e) {
      this.session.debug('*** XMPP ERROR (rl catch): ', e);
    }
  }

  presence(stanza) {
    const obj = {
      '@type': 'update',
      actor: {
        '@type': 'person',
        '@id': stanza.attrs.from,
      },
      object: {
        '@type': 'presence',
        status: stanza.getChildText('status') || "",
        presence: (stanza.getChild('show')) ? stanza.getChild('show').getText() :
          stanza.attrs.type || "online"
      }
    };
    if (stanza.attrs.to) {
      obj.target = {'@id': stanza.attrs.to};
    } else {
      obj.actor.displayName = stanza.attrs.from.split('/')[1];
    }
    this.session.debug('received contact presence update from ' + stanza.attrs.from);
    this.session.sendToClient(obj);
  }

  subscribe(to, from, displayName) {
    this.session.debug('received subscribe request from ' + from);
    const actor = { '@id': from };
    if (displayName) {
      actor.displayName = displayName;
    }
    this.session.sendToClient({
      '@type': "request-friend",
      actor: actor,
      target: to
    });
  }

  // unsubscribe(from) {
  //   this.session.debug('received unsubscribe request from ' + from);
  //   this.session.sendToClient({
  //     '@type': "remove-friend",
  //     actor: { '@id': from },
  //     target: this.session.actor
  //   });
  // }

  notifyChatMessage(stanza) {
    const message   = getMessageBody(stanza);
    if (!message) { return; }
    const from      = stanza.attrs.from;
    const timestamp = getMessageTimestamp(stanza);
    const messageId = getMessageId(stanza);
    const type      = stanza.attrs.type === 'groupchat' ? 'room' : 'person';

    const activity = {
      '@type': 'send',
      actor: {
        '@type': 'person',
        '@id': from,
      },
      target: {
        '@type': type,
        '@id': stanza.attrs.to,
      },
      object: {
        '@type': 'message',
        '@id': messageId,
        content: message
      }
    };

    if (type === 'room') {
      [activity.target['@id'], activity.actor.displayName] = from.split('/');
    }

    if (timestamp) { activity.published = timestamp; }

    this.session.sendToClient(activity);
  }

  notifyError(stanza) {
    const error = stanza.getChild('error');
    let message = stanza.toString();
    let type = 'message';
    if (stanza.is('presence')) {
      type = 'update';
    }

    if (error) {
      message = error.toString();
      if (error.getChild('remote-server-not-found')) {
        // when we get this.session.type of return message, we know it was a response from a join
        type = 'join';
        message = 'remote server not found ' + stanza.attrs.from;
      }
    }

    this.session.sendToClient({
      '@type': type,
      actor: {
        '@id': stanza.attrs.from,
        '@type': 'room'
      },
      object: {
        '@type': 'error', // type error
        content: message
      },
      target: {
        '@id': stanza.attrs.to,
        '@type': 'person'
      }
    });
  }

  notifyRoomAttendance(stanza) {
    const query = stanza.getChild('query');
    if (query) {
      let members = [];
      const entries = query.getChildren('item');
      for (let e in entries) {
        if (!entries.hasOwnProperty(e)) {
          continue;
        }
        members.push(entries[e].attrs.name);
      }

      this.session.sendToClient({
        '@type': 'observe',
        actor: {
          '@id': stanza.attrs.from,
          '@type': 'room'
        },
        target: {
          '@id': stanza.attrs.to,
          '@type': 'person'
        },
        object: {
          '@type': 'attendance',
          members: members
        }
      });
    }
  }

  online() {
    this.session.debug('online');
  }

  /**
   * Handles all unknown conditions that we don't have an explicit handler for
   **/
  stanza(stanza) {
    // console.log("incoming stanza ", stanza);
    if ((stanza.attrs.type === 'error')) {
      this.notifyError(stanza);
    } else if (stanza.is('message')) {
      this.notifyChatMessage(stanza);
    } else if (stanza.is('presence')) {
      this.presence(stanza);
    } else if (stanza.is('iq')) {
      if (stanza.attrs.id === 'muc_id' && stanza.attrs.type === 'result') {
        this.session.debug('got room attendance list');
        return this.notifyRoomAttendance(stanza);
      }

      // todo: clean up this area, unsure of what these are
      const query = stanza.getChild('query');
      if (query) {
        const entries = query.getChildren('item');
        for (let e in entries) {
          if (! entries.hasOwnProperty(e)) {
            continue;
          }
          this.session.debug('STANZA ATTRS: ', entries[e].attrs);
          if (entries[e].attrs.subscription === 'both') {
            this.session.sendToClient({
              '@type': 'update',
              actor: { '@id': entries[e].attrs.jid, displayName: entries[e].attrs.name },
              target: this.session.actor,
              object: {
                '@type': 'presence',
                status: '',
                presence: state
              }
            });
          } else if ((entries[e].attrs.subscription === 'from') &&
              (entries[e].attrs.ask) && (entries[e].attrs.ask === 'subscribe')) {
            this.session.sendToClient({
              '@type': 'update',
              actor: { '@id': entries[e].attrs.jid, displayName: entries[e].attrs.name },
              target: this.session.actor,
              object: {
                '@type': 'presence',
                statusText: '',
                presence: 'notauthorized'
              }
            });
          } else {
            /**
             * can't figure out how to know if one of these query stanzas are from
             * added contacts or pending requests
             */
            this.subscribe(this.session.actor, entries[e].attrs.jid, entries[e].attrs.name);
          }
        }
      }
    } else {
      this.session.debug("got XMPP unknown stanza... " + stanza);
    }
  }
}

module.exports = IncomingHandlers;
