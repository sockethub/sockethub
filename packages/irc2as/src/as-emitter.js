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
      context: 'irc',
      type: 'update',
      actor: {
        type: 'person',
        id: nick + '@' + this.server,
        name: nick
      },
      target: {
        type: 'service',
        id: this.server
      },
      error: content
    };
  }

  presence(nick, role, channel) {
    this.emitEvent(EVENT_INCOMING, {
      context: 'irc',
      type: 'update',
      actor: {
        type: 'person',
        id: `${nick}@${this.server}`,
        name: nick,
      },
      target: {
        type: 'room',
        id: this.server + '/' + channel,
        name: channel
      },
      object: {
        type: 'presence',
        role: role
      }
    });
  }

  channelError(channel, nick, content) {
    this.emitEvent(EVENT_ERROR, {
      context: 'irc',
      type: 'update',
      actor: {
        type: 'person',
        id: nick + '@' + this.server
      },
      target: {
        type: 'room',
        id: this.server + '/' + channel
      },
      error: content
    });
  }

  nickError(nick, content) {
    this.emitEvent(EVENT_ERROR, this.__generalError(nick, content));
  }

  notice(nick, content) {
    this.emitEvent(EVENT_INCOMING, {
      context: 'irc',
      type: 'send',
      actor: {
        type: 'service',
        id: this.server
      },
      object: {
        type: 'message',
        content: content
      },
      target: {
        type: 'person',
        id: nick + '@' + this.server,
        name: nick
      }
    });
  }

  serviceError(nick, content) {
    this.emitEvent(EVENT_ERROR, this.__generalError(nick, content));
  }

  joinError(nick) {
    this.emitEvent(EVENT_ERROR, {
      context: 'irc',
      type: 'join',
      actor: {
        id: this.server,
        type: 'service'
      },
      error: 'no such channel ' + nick,
      target: {
        id: nick + '@' + this.server,
        type: 'person'
      }
    });
  }

  topicChange(channel, nick, content) {
    this.emitEvent(EVENT_INCOMING, {
      context: 'irc',
      type: 'update',
      actor: {
        type: 'person',
        id: nick + '@' + this.server,
        name: nick
      },
      target: {
        type: 'room',
        id: this.server + '/' + channel,
        name: channel
      },
      object: {
        type: 'topic',
        content: content
      }
    });
  }

  joinRoom(channel, nick) {
    this.emitEvent(EVENT_INCOMING, {
      context: 'irc',
      type: 'join',
      actor: {
        type: 'person',
        id: nick + '@' + this.server,
        name: nick
      },
      target: {
        type: 'room',
        id: this.server + '/' + channel,
        name: channel
      }
    });
  }

  userQuit(nick) {
    this.emitEvent(EVENT_INCOMING, {
      context: 'irc',
      type: 'leave',
      actor: {
        type: 'person',
        id: nick + '@' + this.server,
        name: nick
      },
      target: {
        type: 'service',
        id: this.server
      },
      object: {
        type: 'message',
        content: 'user has quit'
      }
    });
  }

  userPart(channel, nick) {
    this.emitEvent(EVENT_INCOMING, {
      context: 'irc',
      type: 'leave',
      actor: {
        type: 'person',
        id: nick + '@' + this.server,
        name: nick
      },
      target: {
        type: 'room',
        id: this.server + '/' + channel,
        name: channel
      },
      object: {
        type: 'message',
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
      context: 'irc',
      type: 'send',
      actor: {
        type: 'person',
        id: nick + '@' + this.server,
        name: nick
      },
      target: {
        type: target.startsWith('#') ? "room" : "person",
        id: this.server + '/' + target,
        name: target
      },
      object: {
        type: type,
        content: message
      }
    });
  }

  role(type, nick, target, role, channel) {
    this.emitEvent(EVENT_INCOMING, {
      context: 'irc',
      type: type,
      actor: {
        type: 'person',
        id: nick + '@' + this.server,
        name: nick
      },
      target: {
        type: 'person',
        id: target + '@' + this.server,
        name: target
      },
      object: {
        type: "relationship",
        "relationship": 'role',
        "subject": {
          type: 'presence',
          role: role
        },
        "object": {
          type: 'room',
          id: this.server + '/' + channel,
          name: channel
        }
      }
    });
  }

  nickChange(nick, content) {
    this.emitEvent(EVENT_INCOMING, {
      context: 'irc',
      type: 'update',
      actor: {
        type: 'person',
        id: nick + '@' + this.server,
        name: nick
      },
      target: {
        type: 'person',
        id: content + '@' + this.server,
        name: content
      },
      object: {
        type: 'address'
      }
    });
  }
}

module.exports = ASTemplates;