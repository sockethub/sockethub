
let idCounter = 0;

function nextId() {
  return ++idCounter;
}

// if the platform throws an exception, the worker will kill & restart it, however if a callback comes in there could
// be a race condition which tries to still access session functions which have already been terminated by the worker.
// this function wrapper only calls the session functions if they still exist.
function referenceProtection(session) {
  if (typeof session === 'undefined') { throw new Error('session object not provided'); }
  function checkScope(funcName) {
    return (msg) => {
      if (typeof session[funcName] === 'function') {
        session[funcName](msg);
      }
    }
  }
  return {
    actor: session.actor,
    debug: checkScope('debug'),
    sendToClient: checkScope('sendToClient')
  }
}


class IncomingHandlers {
  constructor(session) {
    this.session = referenceProtection(session);
  }

  buddy(from, state, statusText) {
    if (from !== this.session.actor['@id']) {
      this.session.debug('received buddy presence update: ' + from + ' - ' + state);
      this.session.sendToClient({
        '@type': 'update',
        actor: { '@id': from },
        target: this.session.actor,
        object: {
          '@type': 'presence',
          status: statusText,
          presence: state
        }
      });
    }
  }

  buddyCapabilities(id, capabilities) {
    this.session.debug('received buddyCapabilities: ' + id, capabilities);
  }

  chat(from, message) {
    this.session.debug("received chat message from " + from);
    this.session.sendToClient({
      '@type': 'send',
      actor: {
        '@type': 'person',
        '@id': from
      },
      target: this.session.actor,
      object: {
        '@type': 'message',
        content: message,
        '@id': nextId()
      }
    });
  }

  chatstate(from, name) {
    this.session.debug('received chatstate event: ' + from, name);
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

  error(error) {
    try {
      this.session.debug("*** XMPP ERROR (rl): " + error);
      this.session.sendToClient({
        '@type': 'error',
        object: {
          '@type': 'error',
          content: error
        }
      });
    } catch (e) {
      this.session.debug('*** XMPP ERROR (rl catch): ', e);
    }
  }

  groupBuddy(id, groupBuddy, state, statusText) {
    this.session.debug('received groupbuddy event: ' + id, groupBuddy, state, statusText);
    this.session.sendToClient({
      '@type': 'update',
      actor: {
        '@id': `${id}/${groupBuddy}`,
        '@type': 'person',
        displayName: groupBuddy
      },
      target: {
        '@id': id,
        '@type': 'room'
      },
      object: {
        '@type': 'presence',
        status: statusText,
        presence: state
      }
    });
  }

  groupChat(room, from, message, stamp) {
    this.session.debug('received groupchat event: ' + room, from, message, stamp);
    this.session.sendToClient({
      '@type': 'send',
      actor: {
        '@type': 'person',
        '@id': from
      },
      target: {
        '@type': 'room',
        '@id': room
      },
      object: {
        '@type': 'message',
        content: message,
        '@id': nextId()
      }
    });
  }

  online() {
    this.session.debug('online');
    this.session.debug('reconnectioned ' + this.session.actor['@id']);
  }

  subscribe(from) {
    this.session.debug('received subscribe request from ' + from);
    this.session.sendToClient({
      '@type': "request-friend",
      actor: { '@id': from },
      target: this.session.actor
    });
  }

  unsubscribe(from) {
    this.session.debug('received unsubscribe request from ' + from);
    this.session.sendToClient({
      '@type': "remove-friend",
      actor: { '@id': from },
      target: this.session.actor
    });
  }

  /**
   * Handles all unknown conditions that we don't have an explicit handler for
   **/
  __stanza(stanza) {
    this.session.debug("got XMPP stanza... " + stanza);

    // simple-xmpp currently doesn't seem to handle error state presence so we'll do it here for now.
    // TODO: consider moving this.session.to simple-xmpp once it's ironed out and proven to work well.
    if (stanza.is('presence') && (stanza.attrs.type === 'error')) {
      const error = stanza.getChild('error');
      let message = stanza.toString(),
          type = 'update';

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
    } else if (stanza.is('iq')) {
      if (stanza.attrs.id === 'muc_id' && stanza.attrs.type === 'result') {
        this.session.debug('got room attendance list');
        this.roomAttendance(stanza);
        return;
      }

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
             * cant figure out how to know if one of these query stanzas are from
             * added contacts or pending requests
             */
            this.session.sendToClient({
              '@type': 'request-friend',
              actor: { '@id': entries[e].attrs.jid, displayName: entries[e].attrs.name },
              target: this.session.actor
            });
          }
        }
      }
    }
  }

  roomAttendance(stanza) {
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
}

module.exports = IncomingHandlers;
