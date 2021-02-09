let idCounter = 0;

function nextId() {
  return ++idCounter;
}

// if the platform throws an exception, the worker will kill & restart it, however if a callback comes in there could
// be a race condition which tries to still access session functions which have already been terminated by the worker.
// this function wrapper only calls the session functions if they still exist.
// TODO: remove once confirmed this is no longer needed (after moving to threads from domains)
// function referenceProtection(session) {
//   if (typeof session === 'undefined') { throw new Error('session object not provided'); }
//   function checkScope(funcName) {
//     return (msg) => {
//       if (typeof session[funcName] === 'function') {
//         session[funcName](msg);
//       }
//     }
//   }
//   return {
//     actor: session.actor,
//     debug: checkScope('debug'),
//     sendToClient: checkScope('sendToClient')
//   }
// }

function getMessageBody(stanza) {
  for (let elem of stanza.children) {
    if (elem.name === 'body') {
      return elem.children.join(' ');
    }
  }
}


class IncomingHandlers {
  constructor(session) {
    this.session = session;
  }

  // buddy(from, state, statusText) {
  //   if (from !== this.session.actor['@id']) {
  //     this.session.debug('received buddy presence update: ' + from + ' - ' + state);
  //     this.session.sendToClient({
  //       '@type': 'update',
  //       actor: { '@id': from },
  //       target: this.session.actor,
  //       object: {
  //         '@type': 'presence',
  //         status: statusText,
  //         presence: state
  //       }
  //     });
  //   }
  // }

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
      })
    } catch (e) {
      this.session.debug('*** XMPP ERROR (rl catch): ', e);
    }
  }

  // groupBuddy(id, groupBuddy, state, statusText) {
  //   this.session.debug('received groupbuddy event: ' + id);
  //   this.session.sendToClient({
  //     '@type': 'update',
  //     actor: {
  //       '@id': `${id}/${groupBuddy}`,
  //       '@type': 'person',
  //       displayName: groupBuddy
  //     },
  //     target: {
  //       '@id': id,
  //       '@type': 'room'
  //     },
  //     object: {
  //       '@type': 'presence',
  //       status: statusText,
  //       presence: state
  //     }
  //   });
  // }

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

  handlePresence(stanza) {
  }

  notifyChatMessage(stanza) {
    const from = stanza.attrs.from
    const message = getMessageBody(stanza);
    let to = stanza.attrs.to;
    const actorObj =  {
      '@type': 'person',
      '@id': from,
    };

    let fromName;
    let target_type = 'person';
    if (stanza.attrs.type === 'groupchat') {
      target_type = 'room';
      [to, fromName] = from.split('/');
      actorObj.displayName = fromName;
    }

    this.session.sendToClient({
      '@type': 'send',
      actor: actorObj,
      target: {
        '@type': target_type,
        '@id': to,
      },
      object: {
        '@type': 'message',
        content: message,
        '@id': nextId()
      }
    });
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
      this.handlePresence(stanza);
    } else if (stanza.is('iq')) {
      if (stanza.attrs.id === 'muc_id' && stanza.attrs.type === 'result') {
        this.session.debug('got room attendance list');
        return this.notifyRoomAttendance(stanza);
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
             * can't figure out how to know if one of these query stanzas are from
             * added contacts or pending requests
             */
            this.subscribe(this.session.actor, entries[e].attrs.jid, entries[e].attrs.name)
          }
        }
      }
    // } else {
    //   this.session.debug("got XMPP unknown stanza... " + stanza);
    }
  }
}

module.exports = IncomingHandlers;
