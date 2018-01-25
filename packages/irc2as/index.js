const events = require('events');

const ERR_CHAN_PRIVS = "482",
      ERR_NICK_IN_USE = "433",
      ERR_NO_CHANNEL = "403",
      JOIN = "JOIN",
      MOTD = "372",
      MOTD_END = "376",
      NAMES = "353",
      NAMES_END = "366",
      NICK = "NICK",
      PART = "PART",
      PING = "PING",
      PONG = "PONG",
      PRIVMSG = "PRIVMSG",
      QUIT = "QUIT",
      TOPIC_CHANGE = "TOPIC",
      TOPIC_IS = "332",
      TOPIC_SET_BY = "333";

function IrcToActivityStreams(cfg) {
    const config = cfg || {};
    this.server = config.server;
    this.events = new events.EventEmitter();
    this.__buffer = {};
    this.__buffer[NAMES] = {};
    return this;
}

IrcToActivityStreams.prototype.input = function (string) {
    if (typeof string !== 'string') { return false; }
    if (string.length < 3) { return false; }
    string = string.trim();
    const time = Date.now();
    const [metadata, content] = string.split(' :');
    const [server, code, pos1, pos2, pos3, ...msg] = metadata.split(" ");
    const channel = ((typeof pos1 === "string") && (pos1.startsWith('#'))) ? pos1 : 
                    ((typeof pos2 === "string") && (pos2.startsWith('#'))) ? pos2 : 
                    ((typeof pos3 === "string") && (pos3.startsWith('#'))) ? pos3 : undefined;
    let nick, type, message;

    if (metadata === PING) {
        this.events.emit('ping', time);
        return true;
    }

    switch (code) {
        /** */
        case ERR_CHAN_PRIVS: // privs not sufficient
        this.events.emit('stream', {
            '@type': 'send',
            actor: {
              '@type': 'room',
              '@id': 'irc://' + this.server + '/' + channel
            },
            target: {
              '@type': 'person',
              '@id': 'irc://' + pos1 + '@' + this.server
            },
            object: {
              '@type': 'message',
              content: content
            }
        });
        break;

        /** */
        case ERR_NICK_IN_USE: // nick conflict
        this.events.emit('stream', {
            '@type': 'update',
            actor: {
                '@type': 'person',
                '@id': 'irc://' + pos1 + '@' + this.server,
                displayName: pos1
            },
            object: {
                '@type': 'error',
                content: content
            },
            target: {
                '@type': 'person',
                '@id': 'irc://' + pos2 + '@' + this.server,
                displayName: pos2
            },
            published: time
        })
        break;

        /** */
        case ERR_NO_CHANNEL: // no such channel
        this.events.emit('stream', {
            '@type': 'join',
            actor: {
                '@id': 'irc://' + this.server,
                '@type': 'service'
            },
            object: {
                '@type': 'error',
                content: 'no such channel ' + pos2
            },
            target: {
                '@id': 'irc://' + pos2 + '@' + this.server,
                '@type': 'person'
            },
            published: time
        });
        break;
    
        /** */
        case JOIN: // room join
        nick = server.split(/^:/)[1].split('!')[0];
        this.events.emit('stream', {
            '@type': 'join',
            actor: {
                '@type': 'person',
                '@id': 'irc://' + nick + '@' + this.server,
                displayName: nick
            },
            target: {
                '@type': 'room',
                '@id': 'irc://' + this.server + '/' + channel,
                displayName: channel
            },
            object: {},
            published: time
        });
        break;

        /** */
        case MOTD: // MOTD
        if (! this.__buffer[MOTD]) {
            this.__buffer[MOTD] = {
                '@type': 'update',
                actor: {
                    '@type': 'service',
                    '@id': 'irc://' + this.server,
                    displayName: this.server
                },
                object: {
                    '@type': 'topic',
                    content: [ content ]
                },
                published: time
            }
        } else {
            this.__buffer[MOTD].object.content.push(content);
        }
        break; 
        case MOTD_END: // end of MOTD
        this.events.emit('stream', this.__buffer[MOTD]);
        delete this.__buffer[MOTD];
        break;

        /** */
        case NAMES:  // user list
        if (! this.__buffer[NAMES][channel]) {
            this.__buffer[NAMES][channel] = {
                '@type': 'observe',
                actor: {
                    '@type': 'room',
                    '@id': 'irc://' + this.server + '/' + channel,
                    displayName: channel
                },
                object: {
                    '@type': 'attendance',
                    members: content.split(' ')
                },
                published: time
            };
        } else {
            this.__buffer[NAMES][channel].object.members.push(content.split(' '));
        }
        break;
        case NAMES_END: // end user list
        this.events.emit('stream', this.__buffer[NAMES][channel]);
        delete this.__buffer[NAMES][channel];
        break;

        /** */
        case NICK: // nick change
        nick = server.split(/^:/)[1].split('!')[0];
        this.events.emit('stream', {
            '@type': 'update',
            actor: {
                '@type': 'person',
                '@id': 'irc://' + nick + '@' + this.server,
                displayName: nick
            },
            target: {
                '@type': 'person',
                '@id': 'irc://' + content + '@' + this.server,
                displayName: content
            },
            object: {
                '@type': 'address'
            },
            published: time
        });
        break;

        /** */
        case PART: // leaving
        nick = server.split(/^:/)[1].split('!')[0];
        this.events.emit('stream', {
            '@type': 'leave',
            actor: {
                '@type': 'person',
                '@id': 'irc://' + nick + '@' + this.server, 
                displayName: nick
            },
            target: {
                '@type': 'room',
                '@id': 'irc://' + this.server + '/' + channel, 
                displayName: channel
            },
            object: {
                '@type': 'message',
                content: 'user has left the channel'
            },
            published: time
        });
        break;

        /** */
        case PONG: // ping response received
        this.events.emit('pong', time);
        break;

        /** */
        case PRIVMSG: // msg
        nick = server.split(/^:/)[1].split('!')[0];
        if (content.startsWith('+\u0001ACTION ')) {
            type = 'me';
            message = content.split(/^\+\u0001ACTION\s+/)[1].split(/\u0001$/)[0];
        } else {
            type = 'message';
            message = content;
        }

        this.events.emit('stream', {
            '@type': 'send',
            actor: {
              '@type': 'person',
              '@id': 'irc://' + nick + '@' + this.server,
              displayName: nick
            },
            target: {
              displayName: pos1
            },
            object: {
              '@type': type,
              content: message
            },
            published: time
        });
        break;

        /** */
        case QUIT: // quit user
        nick = server.split(/^:/)[1].split('!')[0];
        this.events.emit('stream', {
            '@type': 'leave',
            actor: {
                '@type': 'person',
                '@id': 'irc://' + nick + '@' + this.server, 
                displayName: nick
            },
            target: {
                '@type': 'service',
                '@id': 'irc://' + this.server 
            },
            object: {
                '@type': 'message',
                content: 'user has quit'
            },
            published: time
        });
        break;

        /** */
        case TOPIC_CHANGE: // topic changed now
        nick = server.split(/^:/)[1].split('!')[0];
        this.events.emit('stream', {
            '@type': 'update',
            actor: {
                '@type': 'person',
                '@id': 'irc://' + nick + '@' + this.server,
                displayName: nick
            },
            target: {
                '@type': 'room',
                '@id': 'irc://' + this.server + '/' + channel,
                displayName: channel
            },
            object: {
                '@type': 'topic',
                topic: content
            },
            published: time
        });
        break;

        /** */
        case TOPIC_IS: // topic currently set to
        this.__buffer[TOPIC_IS] = {
            '@type': 'update',
            actor: undefined,
            target: {
                '@type': 'room',
                '@id': 'irc://' + this.server + '/' + channel,
                displayName: channel
            },
            object: {
                '@type': 'topic',
                topic: content
            }
        };
        break;
        case TOPIC_SET_BY: // current topic set by
        nick = pos3.split('!')[0];
        this.__buffer[TOPIC_IS].actor = {
            '@type': 'person',
            '@id': 'irc://' + nick + '@' + this.server,
            displayName: nick
        };
        this.__buffer[TOPIC_IS].published = msg[0];
        this.events.emit('stream', this.__buffer[TOPIC_IS]);
        delete this.__buffer[TOPIC_IS];
        break;

        /** */
        default:
        this.events.emit('unprocessed', string);
        break;
    }
}

module.exports = IrcToActivityStreams;