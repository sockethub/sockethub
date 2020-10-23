const EVENT_INCOMING = 'incoming',
      EVENT_ERROR = 'error';

class ASTemplates {
  constructor(events, server) {
    this.server = server;
    this.events = events;
  }

  emitEvent(code, asObject) {
    if ((typeof asObject === 'object') && (! asObject.published)) {
      asObject.published = `${Date.now()}`;
    }
    this.events.emit(code, asObject);
  }

  __generalError(nick, content) {
    return {
      '@type': 'update',
      actor: {
          '@type': 'service',
          '@id': this.server
      },
      object: {
          '@type': 'error',
          content: content
      },
      target: {
          '@type': 'person',
          '@id': nick + '@' + this.server,
          displayName: nick
      }
    };
  }

  presence(nick, role, channel) {
    this.emitEvent(EVENT_INCOMING, {
        '@type': 'update',
        actor: {
            '@type': 'person',
            '@id': `${nick}@${this.server}`,
            'displayName': nick,
        },
        target: {
            '@type': 'room',
            '@id': this.server + '/' + channel,
            displayName: channel
        },
        object: {
            '@type': 'presence',
            role: role
        }
    });
  };

  channelError(channel, nick, content) {
    this.emitEvent(EVENT_ERROR, {
      '@type': 'send',
      actor: {
        '@type': 'room',
        '@id': this.server + '/' + channel
      },
      target: {
        '@type': 'person',
        '@id': nick + '@' + this.server
      },
      object: {
        '@type': 'error',
        content: content
      }
    });
  }

  nickError(nick, content) {
    this.emitEvent(EVENT_ERROR, this.__generalError(nick, content));
  }

  notice(nick, content) {
    this.emitEvent(EVENT_INCOMING, this.__generalError(nick, content));
  }

  serviceError(nick, content) {
    this.emitEvent(EVENT_ERROR, this.__generalError(nick, content));
  }

  joinError(nick) {
    this.emitEvent(EVENT_ERROR, {
      '@type': 'join',
      actor: {
          '@id': this.server,
          '@type': 'service'
      },
      object: {
          '@type': 'error',
          content: 'no such channel ' + nick
      },
      target: {
          '@id': nick + '@' + this.server,
          '@type': 'person'
      }
    });
  }

  topicChange(channel, nick, content) {
    this.emitEvent(EVENT_INCOMING, {
      '@type': 'update',
      actor: {
          '@type': 'person',
          '@id': nick + '@' + this.server,
          displayName: nick
      },
      target: {
          '@type': 'room',
          '@id': this.server + '/' + channel,
          displayName: channel
      },
      object: {
          '@type': 'topic',
          topic: content
      }
    });
  }

  joinRoom(channel, nick) {
    this.emitEvent(EVENT_INCOMING, {
      '@type': 'join',
      actor: {
          '@type': 'person',
          '@id': nick + '@' + this.server,
          displayName: nick
      },
      target: {
          '@type': 'room',
          '@id': this.server + '/' + channel,
          displayName: channel
      },
      object: {}
    });
  }

  userQuit(nick) {
    this.emitEvent(EVENT_INCOMING, {
      '@type': 'leave',
      actor: {
          '@type': 'person',
          '@id': nick + '@' + this.server,
          displayName: nick
      },
      target: {
          '@type': 'service',
          '@id': this.server
      },
      object: {
          '@type': 'message',
          content: 'user has quit'
      }
    });
  }

  userPart(channel, nick) {
    this.emitEvent(EVENT_INCOMING, {
      '@type': 'leave',
      actor: {
          '@type': 'person',
          '@id': nick + '@' + this.server,
          displayName: nick
      },
      target: {
          '@type': 'room',
          '@id': this.server + '/' + channel,
          displayName: channel
      },
      object: {
          '@type': 'message',
          content: 'user has left the channel'
      }
    });
  }

  privMsg(nick, target, content) {
    let type, message;
    if (content.startsWith('+\u0001ACTION ')) {
      type = 'me';
      message = content.split(/^\+\u0001ACTION\s+/)[1].split(/\u0001$/)[0];
    } else {
      type = 'message';
      message = content;
    }
    this.emitEvent(EVENT_INCOMING, {
      '@type': 'send',
      actor: {
        '@type': 'person',
        '@id': nick + '@' + this.server,
        displayName: nick
      },
      target: {
        displayName: target
      },
      object: {
        '@type': type,
        content: message
      }
    });
  }

  role(type, nick, target, role, channel) {
    this.emitEvent(EVENT_INCOMING, {
      '@type': type,
      actor: {
          '@type': 'person',
          '@id': nick + '@' + this.server,
          displayName: nick
      },
      target: {
          '@type': 'person',
          '@id': target + '@' + this.server,
          displayName: target
      },
      object: {
          "@type": "relationship",
          "relationship": 'role',
          "subject": {
              '@type': 'presence',
              role: role
          },
          "object": {
              '@type': 'room',
              '@id': this.server + '/' + channel,
              displayName: channel
          }
      }
    });
  }

  nickChange(nick, content) {
    this.emitEvent(EVENT_INCOMING, {
      '@type': 'update',
      actor: {
          '@type': 'person',
          '@id': nick + '@' + this.server,
          displayName: nick
      },
      target: {
          '@type': 'person',
          '@id': content + '@' + this.server,
          displayName: content
      },
      object: {
          '@type': 'address'
      }
    });
  }
}

module.exports = ASTemplates;