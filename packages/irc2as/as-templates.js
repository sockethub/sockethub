const EVENT_INCOMING = 'incoming',
      EVENT_ERROR = 'error';

class ASTemplates {
  constructor(events, server) {
    this.server = server;
    this.events = events;
  }

  presence(nick, role, channel) {
    this.events.emit(EVENT_INCOMING, {
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
        },
        published: `${Date.now()}`
    });
  };

  channelError(channel, nick, content) {
    this.events.emit(EVENT_ERROR, {
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
      },
      published: `${Date.now()}`
    });
  }

  serviceError(nick, content) {
    this.events.emit(EVENT_ERROR, {
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
      },
      published: `${Date.now()}`
    });
  }

  joinError(nick) {
    this.events.emit(EVENT_ERROR, {
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
      },
      published: `${Date.now()}`
    });
  }

  nickError(nick, content) {
    this.events.emit(EVENT_ERROR, {
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
      },
      published: `${Date.now()}`
    });
  }

  topicChange(channel, nick, content) {
    this.events.emit(EVENT_INCOMING, {
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
      },
      published: `${Date.now()}`
    });
  }

  joinRoom(channel, nick) {
    this.events.emit(EVENT_INCOMING, {
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
      object: {},
      published: `${Date.now()}`
    });
  }

  userQuit(nick) {
    this.events.emit(EVENT_INCOMING, {
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
      },
      published: `${Date.now()}`
    });
  }

  userPart(channel, nick) {
    this.events.emit(EVENT_INCOMING, {
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
      },
      published: `${Date.now()}`
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
    this.events.emit(EVENT_INCOMING, {
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
      },
      published: `${Date.now()}`
    });
  }

  role(type, nick, target, role, channel) {
    this.events.emit(EVENT_INCOMING, {
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
      },
      published: `${Date.now()}`
    });
  }

  nickChange(nick, content) {
    this.events.emit(EVENT_INCOMING, {
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
      },
      published: `${Date.now()}`
    });
  }

  notice(nick, content) {
    this.events.emit(EVENT_INCOMING, {
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
      },
      published: `${Date.now()}`
    });
  }
}

module.exports = ASTemplates;